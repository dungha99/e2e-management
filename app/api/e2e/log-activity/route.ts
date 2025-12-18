import { NextRequest, NextResponse } from "next/server"

const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""
const VUCAR_API_BASE_URL = "https://api.vucar.vn"

interface LogActivityRequest {
    leadId: string
    activityType: string
    metadata: {
        field_name: string
        previous_value?: string | number | null
        new_value?: string | number | null
        channel?: string
        segment?: string
        account?: string
    }
    actorType?: string
    field?: string
}

export async function POST(request: NextRequest) {
    try {
        const body: LogActivityRequest = await request.json()
        const { leadId, activityType, metadata, actorType, field } = body

        if (!leadId || !activityType) {
            return NextResponse.json(
                { error: "leadId and activityType are required" },
                { status: 400 }
            )
        }

        console.log("[LOG_SALE_ACTIVITY] Logging activity:", {
            leadId,
            activityType,
            field: metadata?.field_name || field
        })

        const payload = {
            leadId,
            activityType,
            metadata,
            actorType: actorType || "USER",
            field: field || metadata?.field_name,
        }

        const response = await fetch(`${VUCAR_API_BASE_URL}/sale-activities`, {
            method: "POST",
            headers: {
                "x-api-secret": VUCAR_API_SECRET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        const responseText = await response.text()
        console.log("[LOG_SALE_ACTIVITY] API response:", response.status, responseText)

        if (!response.ok) {
            console.error("[LOG_SALE_ACTIVITY] API error:", response.status, responseText)
            return NextResponse.json(
                { error: "Failed to log activity", details: responseText },
                { status: response.status }
            )
        }

        // Try to parse as JSON
        let result
        try {
            result = JSON.parse(responseText)
        } catch {
            result = { success: true, raw: responseText }
        }

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error("[LOG_SALE_ACTIVITY] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
