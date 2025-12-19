import { NextRequest, NextResponse } from "next/server"

const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""
const VUCAR_API_BASE_URL = "https://api.vucar.vn"

// Helper function to log ZNS sale activity
async function logZnsSaleActivity(
  leadId: string,
  znsCode: string,
  phoneNumber: string,
  sentStatus: "success" | "failed",
  errorMessage?: string
) {
  const metadata = {
    zns_code: znsCode,
    content: `ZNS Template ${znsCode}`,
    sent_status: sentStatus,
    phone_number: phoneNumber,
    error_message: errorMessage || null,
    sent_at: new Date().toISOString(),
  }

  const payload = {
    leadId,
    activityType: "ZNS",
    metadata,
    actorType: "USER",
    field: "zns_notification",
  }

  console.log("[ZNS_SALE_ACTIVITY] Logging ZNS activity:", JSON.stringify(payload))

  try {
    const response = await fetch(`${VUCAR_API_BASE_URL}/sale-activities`, {
      method: "POST",
      headers: {
        "x-api-secret": VUCAR_API_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log("[ZNS_SALE_ACTIVITY] Response:", response.status, responseText)

    if (!response.ok) {
      console.error("[ZNS_SALE_ACTIVITY] API error:", response.status, responseText)
    }
  } catch (error) {
    console.error("[ZNS_SALE_ACTIVITY] Failed to log activity:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, phoneNumbers, leadId } = body

    if (!code || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: "code and phoneNumbers are required" },
        { status: 400 }
      )
    }

    const response = await fetch("https://api.vucar.vn/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": VUCAR_API_SECRET,
      },
      body: JSON.stringify({
        code,
        phoneNumbers,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Send Notification] API error:", response.status, errorText)

      // Log failed ZNS activity if leadId is provided
      if (leadId) {
        for (const phone of phoneNumbers) {
          await logZnsSaleActivity(leadId, code, phone, "failed", errorText)
        }
      }

      return NextResponse.json(
        { error: "Failed to send notification", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Log ZNS sale activity for each phone number if leadId is provided
    if (leadId) {
      // Determine success/failure for each phone number from the response
      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          const phone = result.phone || phoneNumbers[0]
          const status = result.value?.status === 'success' ? 'success' : 'failed'
          const errorMsg = status === 'failed' ? (result.value?.error || result.reason) : undefined
          await logZnsSaleActivity(leadId, code, phone, status, errorMsg)
        }
      } else if (data.success && (!data.failedSends || data.failedSends === 0)) {
        // All succeeded
        for (const phone of phoneNumbers) {
          await logZnsSaleActivity(leadId, code, phone, "success")
        }
      } else {
        // Unknown state, log as success (conservative approach)
        for (const phone of phoneNumbers) {
          await logZnsSaleActivity(leadId, code, phone, "success")
        }
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[Send Notification] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
