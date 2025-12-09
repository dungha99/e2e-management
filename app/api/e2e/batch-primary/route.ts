import { NextResponse } from "next/server"
import { tempInspectionQuery } from "@/lib/db"
import { getCached } from "@/lib/cache"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_ids } = body

    if (!car_ids || !Array.isArray(car_ids) || car_ids.length === 0) {
      return NextResponse.json({ primary_statuses: {} })
    }

    // Filter out null/undefined car_ids
    const validCarIds = car_ids.filter(id => id != null)

    if (validCarIds.length === 0) {
      return NextResponse.json({ primary_statuses: {} })
    }

    // Create a cache key from sorted car_ids (so same set = same key)
    const cacheKey = `primary:${validCarIds.slice().sort().join(',')}`

    const primaryStatuses = await getCached(
      cacheKey,
      async () => {
        // Query primary status for all car_ids in one go
        const placeholders = validCarIds.map((_, i) => `$${i + 1}`).join(',')
        const result = await tempInspectionQuery(
          `SELECT car_id, is_primary FROM "primary" WHERE car_id IN (${placeholders})`,
          validCarIds
        )

        // Build a map of car_id -> is_primary
        const statuses: Record<string, boolean> = {}
        result.rows.forEach(row => {
          statuses[row.car_id] = row.is_primary || false
        })
        return statuses
      },
      60 // Cache for 1 minute - primary status changes occasionally
    )

    return NextResponse.json({ primary_statuses: primaryStatuses })
  } catch (error) {
    console.error("[E2E Batch Primary] Error fetching primary statuses:", error)
    // Return empty map instead of error to allow graceful handling
    return NextResponse.json({ primary_statuses: {} })
  }
}
