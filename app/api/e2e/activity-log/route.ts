import { NextResponse } from "next/server"
import { getCached } from "@/lib/cache"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    const cacheKey = `activity-log:${phone}`

    const activityLog = await getCached(
      cacheKey,
      async () => {
        // Fetch from n8n webhook
        const response = await fetch(
          `https://n8n.vucar.vn/webhook/824be9f2-9b69-4ca7-ac29-ffb91fe41cf4/824be9f2-9b69-4ca7-ac29-ffb91fe41cf4/${phone}`
        )

        if (!response.ok) {
          console.log("[Activity Log API] n8n response not OK:", response.status)
          return []
        }

        const data = await response.json()
        return Array.isArray(data) ? data : []
      },
      120 // Cache for 2 minutes - activity changes occasionally
    )

    return NextResponse.json(activityLog)
  } catch (error) {
    console.error("[Activity Log API] Error fetching activity log:", error)
    return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 })
  }
}
