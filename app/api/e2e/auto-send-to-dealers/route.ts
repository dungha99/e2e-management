import { NextResponse } from "next/server"
import { vucarV2Query, query, e2eQuery } from "@/lib/db"
import { filterDealers } from "@/lib/dealer-filter"
import { resolveVucarGroupId, cacheVucarGroupMapping } from "@/lib/vucar-zalo-groups"
import { VUCAR_SEND_BASE_URL, VUCAR_SEND_CONNECTOR_ID } from "@/lib/vucar-zalo-accounts"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { b_user_id, message, image_urls } = body

    if (!b_user_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: b_user_id, message" },
        { status: 400 }
      )
    }

    // ── Step 1: Extract car_id from message ──────────────────────────────────
    // Message contains a line: "Mã tin xe: <car_id>"
    const carIdMatch = message.match(/Mã tin xe:\s*(\S+)/)
    if (!carIdMatch) {
      return NextResponse.json(
        { error: "Cannot find car_id in message. Expected line: 'Mã tin xe: <id>'" },
        { status: 400 }
      )
    }
    const carId = carIdMatch[1]
    console.log(`[auto-send] Extracted car_id: ${carId}`)

    // ── Step 2: Fetch car attributes for filtering ───────────────────────────
    const carResult = await vucarV2Query(
      `SELECT
         c.brand,
         c.year,
         c.location,
         c.mileage,
         ss.price_customer
       FROM cars c
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1
       LIMIT 1`,
      [carId]
    )

    if (carResult.rows.length === 0) {
      return NextResponse.json({ error: `Car not found: ${carId}` }, { status: 404 })
    }

    const car = carResult.rows[0]
    const currentYear = new Date().getFullYear()
    const car_age = car.year ? currentYear - parseInt(car.year) : -1

    console.log(`[auto-send] Car: brand=${car.brand}, city=${car.location}, price=${car.price_customer}, age=${car_age}, mileage=${car.mileage}`)

    // ── Step 3: Filter dealers ───────────────────────────────────────────────
    const { dealer_ids, is_default } = await filterDealers({
      brand: car.brand ?? null,
      city: car.location ?? null,
      price: car.price_customer ? parseInt(String(car.price_customer)) : 0,
      car_age,
      mileage: car.mileage ? parseInt(String(car.mileage)) : 0,
    })

    console.log(`[auto-send] Matched ${dealer_ids.length} dealers (is_default=${is_default})`)

    // ── Step 4: Get dealer names + Zalo group names from DRM ─────────────────
    const dealersResult = await query(
      `SELECT id, name, group_zalo_name FROM dealers WHERE id = ANY($1::uuid[]) AND is_active = TRUE`,
      [dealer_ids]
    )

    const dealers = dealersResult.rows.filter((d: any) => d.group_zalo_name)

    if (dealers.length === 0) {
      return NextResponse.json({
        car_id: carId,
        is_default,
        dealers_matched: dealer_ids.length,
        message: "No dealers with a Zalo group found — nothing sent",
        successCount: 0,
        results: [],
      })
    }

    // ── Step 5: Resolve Vucar account for b_user_id ──────────────────────────
    const accountResult = await e2eQuery(
      `SELECT id, phone, account_name, abitstore_id, dynamic_key, default_group_id,
              get_groups_key, smownerid, account_type, b_user_id
       FROM abit_zalo_accounts
       WHERE b_user_id = $1 AND account_type = 'vucar' AND is_active = true
       LIMIT 1`,
      [b_user_id]
    )

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: `No active vucar account found for b_user_id ${b_user_id}` },
        { status: 404 }
      )
    }

    const accountRow = accountResult.rows[0]

    const userResult = await vucarV2Query(
      `SELECT zalo_owner_id FROM users WHERE id = $1 LIMIT 1`,
      [b_user_id]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].zalo_owner_id) {
      return NextResponse.json(
        { error: `No zalo_owner_id found for b_user_id ${b_user_id}` },
        { status: 404 }
      )
    }

    const ownId = userResult.rows[0].zalo_owner_id

    const connectorResult = await e2eQuery(
      `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_SEND_CONNECTOR_ID]
    )

    if (connectorResult.rows.length === 0) {
      return NextResponse.json({ error: "Vucar send connector not configured" }, { status: 500 })
    }

    let authConfig = connectorResult.rows[0].auth_config
    if (typeof authConfig === "string") authConfig = JSON.parse(authConfig)

    let bearerToken: string | null = null
    if (authConfig?.type === "bearer" && authConfig?.token) {
      bearerToken = authConfig.token
    } else if (authConfig?.Authorization) {
      bearerToken = authConfig.Authorization.replace(/^Bearer\s+/i, "")
    } else if (authConfig?.authorization) {
      bearerToken = authConfig.authorization.replace(/^Bearer\s+/i, "")
    }

    if (!bearerToken) {
      return NextResponse.json({ error: "No bearer token in connector config" }, { status: 500 })
    }

    const account = { ...accountRow, own_id: ownId, bearer_token: bearerToken }

    // ── Step 6: Send to each dealer group + create bidding records ────────────
    const results = []

    for (const dealer of dealers) {
      try {
        const groupId = await resolveVucarGroupId(dealer.group_zalo_name, account)

        const url = VUCAR_SEND_BASE_URL
          .replace("{ownId}", ownId)
          .replace("{groupId}", groupId)

        const sendResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            message,
            image_urls: image_urls || [],
          }),
        })

        if (!sendResponse.ok) {
          throw new Error(`Vucar API ${sendResponse.status}: ${await sendResponse.text()}`)
        }

        await cacheVucarGroupMapping(account.id, groupId, dealer.group_zalo_name)

        // Create bidding record
        await query(
          `INSERT INTO dealer_biddings (id, car_id, dealer_id, price, comment, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [crypto.randomUUID(), carId, dealer.id, 1, "Đã gửi thông tin xe"]
        )

        console.log(`[auto-send] Sent to "${dealer.group_zalo_name}" (dealer: ${dealer.name})`)
        results.push({ dealer_id: dealer.id, dealer_name: dealer.name, group_zalo_name: dealer.group_zalo_name, success: true })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[auto-send] Failed for dealer "${dealer.name}":`, errMsg)
        results.push({ dealer_id: dealer.id, dealer_name: dealer.name, group_zalo_name: dealer.group_zalo_name, success: false, error: errMsg })
      }
    }

    // Update account usage
    await e2eQuery(
      `UPDATE abit_zalo_accounts SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = $1`,
      [account.id]
    )

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      car_id: carId,
      is_default,
      dealers_matched: dealers.length,
      successCount,
      total: dealers.length,
      results,
    })
  } catch (error) {
    console.error("[auto-send-to-dealers] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to auto-send to dealers",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
