import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const carId = searchParams.get('carId')
        const phone = searchParams.get('phone')

        // First, check the sale_activities table structure
        const schemaResult = await vucarV2Query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'sale_activities'
             ORDER BY ordinal_position`
        )

        if (!carId && !phone) {
            return NextResponse.json({
                message: "Pass carId or phone param to check specific car/lead",
                sale_activities_columns: schemaResult.rows
            })
        }

        // Find the lead by carId or phone
        let carResult;
        if (carId) {
            carResult = await vucarV2Query(
                `SELECT c.id as car_id, c.lead_id, l.name as lead_name, l.phone, l.pic_id
                 FROM cars c
                 LEFT JOIN leads l ON l.id = c.lead_id
                 WHERE c.id = $1::uuid`,
                [carId]
            )
        } else {
            carResult = await vucarV2Query(
                `SELECT c.id as car_id, c.lead_id, l.name as lead_name, l.phone, l.pic_id
                 FROM leads l
                 LEFT JOIN cars c ON c.lead_id = l.id
                 WHERE l.phone = $1
                 ORDER BY c.created_at DESC
                 LIMIT 1`,
                [phone]
            )
        }

        if (carResult.rows.length === 0) {
            return NextResponse.json({ error: "Car/Lead not found", carId, phone, sale_activities_columns: schemaResult.rows })
        }

        const car = carResult.rows[0]

        // Get all sale_activities for this lead
        const activitiesResult = await vucarV2Query(
            `SELECT *
             FROM sale_activities
             WHERE lead_id = $1::uuid
             ORDER BY created_at DESC
             LIMIT 20`,
            [car.lead_id]
        )

        // Check specifically for INSPECTION_COMPLETED using the EXACT same query as batch API
        const inspectionResult = await vucarV2Query(
            `SELECT DISTINCT ON (lead_id)
                lead_id,
                metadata,
                created_at,
                activity_type
             FROM sale_activities
             WHERE lead_id = $1::uuid
               AND activity_type = 'INSPECTION_COMPLETED'
               AND metadata->>'location' IS NOT NULL
               AND metadata->>'inspector' IS NOT NULL
             ORDER BY lead_id, created_at DESC`,
            [car.lead_id]
        )

        // Simulate the batch API logic EXACTLY
        const inspectionSchedule = inspectionResult.rows.length > 0 ? (() => {
            const row = inspectionResult.rows[0]
            const metadata = row.metadata
            if (!metadata || !metadata.location || !metadata.inspector) {
                return { error: "Missing location or inspector in metadata", metadata }
            }
            return {
                location: metadata.location,
                inspector: metadata.inspector,
                scheduled_at: row.created_at,
            }
        })() : null

        return NextResponse.json({
            sale_activities_columns: schemaResult.rows,
            car: car,
            all_activities: activitiesResult.rows.map((a: any) => ({
                id: a.id,
                activity_type: a.activity_type,
                metadata: a.metadata,
                created_at: a.created_at
            })),
            inspection_raw: inspectionResult.rows,
            inspection_schedule_result: inspectionSchedule,
            debug_message: inspectionSchedule && !('error' in inspectionSchedule)
                ? "Inspection schedule SHOULD appear in UI"
                : "No valid inspection schedule found - check inspection_schedule_result for details"
        })
    } catch (error) {
        console.error("[Debug API] Error:", error)
        return NextResponse.json({
            error: "Failed to query",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
