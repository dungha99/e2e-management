import { NextResponse } from "next/server"

const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""
const VUCAR_API_BASE_URL = "https://api.vucar.vn"

export async function GET() {
    try {
        const url = `${VUCAR_API_BASE_URL}/notifications/templates?type=&send_with=`

        console.log("[Notification Templates] Fetching from:", url)

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-api-secret": VUCAR_API_SECRET,
                "Content-Type": "application/json",
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[Notification Templates] API error:", response.status, errorText)
            return NextResponse.json(
                { error: "Failed to fetch templates", details: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        console.log("[Notification Templates] Fetched", data?.length || 0, "templates")

        return NextResponse.json(data)
    } catch (error) {
        console.error("[Notification Templates] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
