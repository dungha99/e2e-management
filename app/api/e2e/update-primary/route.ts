import { NextResponse } from "next/server"
import { tempInspectionQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id, is_primary } = body

    if (!car_id || is_primary === undefined) {
      return NextResponse.json({ error: "car_id and is_primary are required" }, { status: 400 })
    }

    // Check if record exists
    const existingResult = await tempInspectionQuery(
      `SELECT id FROM "primary" WHERE car_id = $1 LIMIT 1`,
      [car_id]
    )

    if (existingResult.rows.length > 0) {
      // Update existing record
      await tempInspectionQuery(
        `UPDATE "primary" SET is_primary = $1 WHERE car_id = $2`,
        [is_primary, car_id]
      )
    } else {
      // Insert new record
      await tempInspectionQuery(
        `INSERT INTO "primary" (car_id, is_primary) VALUES ($1, $2)`,
        [car_id, is_primary]
      )
    }

    return NextResponse.json({
      success: true,
      car_id,
      is_primary
    })
  } catch (error) {
    console.error("[E2E Update Primary] Error updating primary status:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to update primary status"
    }, { status: 500 })
  }
}
