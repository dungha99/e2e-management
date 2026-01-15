import { NextRequest, NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params

        const result = await vucarV2Query(
            `SELECT ss.notes
             FROM sale_status ss
             JOIN cars c ON ss.car_id = c.id
             WHERE c.lead_id = $1
             ORDER BY c.created_at DESC
             LIMIT 1`,
            [leadId]
        )

        const notes = result.rows.length > 0 ? result.rows[0].notes || "" : ""

        return NextResponse.json({ notes })
    } catch (error) {
        console.error("[GET /api/e2e/leads/[leadId]/notes] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
