import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery } from "@/lib/db"

// Connector ID for Vucar Zalo friends/send-message
const VUCAR_FRIENDS_CONNECTOR_ID = "a1b8debd-7e9d-45d4-8804-cb817d5504f5"

/**
 * POST /api/zalo/send-bidding-link
 *
 * Sends a Zalo message to the customer linked to a car, using the Vucar Zalo API.
 * Steps:
 *   1. Look up `zalo_account` (ownerId:threadId) from leads via car_id
 *   2. Look up `slug` from cars table for the bidding link
 *   3. Fetch bearer token from api_connectors
 *   4. POST to https://zl.vucar.vn/api/accounts/{ownerId}/friends/send-message
 *
 * Body: { car_id: string, car_odo?: number, message?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // message_body: the editable text the user typed (without the "Link phiên:" line)
    // The server always appends the real link at the end.
    const { car_id, message_body } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    // --- Step 1: Get zalo_account (ownerId:threadId) and car slug ---
    const carResult = await vucarV2Query(
      `SELECT l.zalo_account, c.slug
       FROM cars c
       JOIN leads l ON l.id = c.lead_id
       WHERE c.id = $1
       LIMIT 1`,
      [car_id]
    )

    if (!carResult.rows.length) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    const { zalo_account, slug } = carResult.rows[0]

    if (!zalo_account) {
      return NextResponse.json({ error: "No zalo_account linked to this car" }, { status: 422 })
    }

    const parts = zalo_account.split(":")
    const ownerId = parts[0] || ""
    const threadId = parts[1] || ""

    if (!ownerId || !threadId) {
      return NextResponse.json(
        { error: `Invalid zalo_account format: "${zalo_account}"` },
        { status: 422 }
      )
    }

    // --- Step 2: Fetch connector URL + bearer token ---
    const connectorResult = await e2eQuery(
      `SELECT base_url, auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_FRIENDS_CONNECTOR_ID]
    )

    if (!connectorResult.rows.length) {
      return NextResponse.json(
        { error: `Connector ${VUCAR_FRIENDS_CONNECTOR_ID} not found` },
        { status: 500 }
      )
    }

    let { base_url, auth_config } = connectorResult.rows[0]
    if (typeof auth_config === "string") {
      try { auth_config = JSON.parse(auth_config) } catch { /* keep */ }
    }

    let bearerToken: string | null = null
    if (auth_config?.type === "bearer" && auth_config?.token) {
      bearerToken = auth_config.token
    } else if (auth_config?.Authorization) {
      bearerToken = auth_config.Authorization.replace(/^Bearer\s+/i, "")
    } else if (auth_config?.authorization) {
      bearerToken = auth_config.authorization.replace(/^Bearer\s+/i, "")
    }

    if (!bearerToken) {
      return NextResponse.json({ error: "No bearer token in connector config" }, { status: 500 })
    }

    // Replace {ownId} template in the base URL
    const url = (base_url as string).replace("{ownId}", ownerId)

    // --- Step 3: Build the final message ---
    // Always append the real bidding link at the end, regardless of what the client sent.
    const biddingLink = slug
      ? `https://vucar.vn/phien-dau-gia/tin-xe/${slug}`
      : null

    const body_text = (message_body as string | undefined)?.trim() || ""
    const message = [
      body_text || null,
      biddingLink ? `Link phiên: ${biddingLink}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    // --- Step 4: Send Zalo message ---
    const zaloRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        userId: threadId,
        messages: [message],
      }),
    })

    const zaloData = await zaloRes.json().catch(() => ({}))

    if (!zaloRes.ok) {
      console.error("[send-bidding-link] Zalo API error:", zaloRes.status, zaloData)
      return NextResponse.json(
        { error: "Zalo API returned an error", detail: zaloData },
        { status: zaloRes.status }
      )
    }

    return NextResponse.json({ success: true, data: zaloData })
  } catch (error) {
    console.error("[send-bidding-link] Unexpected error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
