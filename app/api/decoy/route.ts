import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://crm-vucar-api.vucar.vn"
const VUCAR_API_BASE_URL = "https://api.vucar.vn"
const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${BASE_URL}/api/v1/decoy/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to create decoy job", details: data }, { status: response.status })
    }

    // Create sale_activities record for the decoy creation
    if (body.leadId) {
      try {
        const activityPayload = {
          leadId: body.leadId,
          activityType: "DECOY_SUMMARY",
          metadata: {
            field_name: "decoy_zalo",
            phone: body.phone,
            account: body.account,
            shop_id: body.shop_id,
            segment: body.segment,
            first_message: body.first_message,
            decoy_job_id: data.id,
          },
          actorType: "USER",
          field: "decoy_zalo",
        }

        console.log("[DECOY_API] Logging sale activity:", activityPayload)

        const activityResponse = await fetch(`${VUCAR_API_BASE_URL}/sale-activities`, {
          method: "POST",
          headers: {
            "x-api-secret": VUCAR_API_SECRET,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(activityPayload),
        })

        if (!activityResponse.ok) {
          const activityError = await activityResponse.text()
          console.error("[DECOY_API] Failed to log sale activity:", activityResponse.status, activityError)
        } else {
          console.log("[DECOY_API] Sale activity logged successfully")
        }
      } catch (activityError) {
        console.error("[DECOY_API] Error logging sale activity:", activityError)
        // Don't fail the main request if activity logging fails
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in decoy API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
