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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params
        const body = await request.json()
        const { notes } = body

        // First find the car_id for this lead
        const carResult = await vucarV2Query(
            `SELECT c.id as car_id 
             FROM cars c 
             WHERE c.lead_id = $1 
             ORDER BY c.created_at DESC 
             LIMIT 1`,
            [leadId]
        )

        if (carResult.rows.length === 0) {
            return NextResponse.json({ error: "Car not found for this lead" }, { status: 404 })
        }

        const carId = carResult.rows[0].car_id

        // Update the sale_status notes
        await vucarV2Query(
            `UPDATE sale_status SET notes = $1 WHERE car_id = $2`,
            [notes, carId]
        )

        return NextResponse.json({ success: true, notes })
    } catch (error) {
        console.error("[PUT /api/e2e/leads/[leadId]/notes] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
