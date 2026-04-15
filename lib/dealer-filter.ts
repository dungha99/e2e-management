/**
 * Shared dealer filtering logic.
 * Replicates the n8n "filter dealers" workflow using the DRM PostgreSQL connection.
 * Falls back to 11 default dealers if no rows match.
 */

import { query } from "@/lib/db"

export const DEFAULT_DEALER_IDS = [
  "00bc5237-400a-4bff-8428-5daa11b37bfa",
  "09e619fc-177a-431c-83ba-29f9afdad880",
  "0feb0bc6-22cc-402c-b737-f1f8b931a2d5",
  "19cbc61d-9eb9-4c36-9741-627f60e218ef",
  "30a7e452-7b82-4295-bd69-9e90cf5f138a",
  "45452bc3-c718-4645-9e6d-a44d90d353a6",
  "4ab8bd3f-1edc-4d04-b76c-bb5aeeb24a73",
  "bbeef717-a40a-43c6-bdf7-6a0d005ca4f2",
  "c69a3475-362c-41fa-b21a-664d29dbaa53",
  "c6e5ec3b-19a3-429c-aff7-f4838666d8aa",
  "d420256d-f581-4505-8481-3682014cf62e",
]

export interface DealerFilterParams {
  brand: string | null  // null = skip filter
  city: string | null   // null = skip filter
  price: number         // 0 = skip filter
  car_age: number       // -1 = skip filter
  mileage: number       // 0 = skip filter
}

export interface FilterDealersResult {
  dealer_ids: string[]
  is_default: boolean
}

export async function filterDealers(params: DealerFilterParams): Promise<FilterDealersResult> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  // include_brand_lower contains '*' OR contains the brand
  // AND exclude_brand_lower IS NULL OR does NOT contain the brand
  if (params.brand !== null) {
    const brandLower = params.brand.toLowerCase()
    conditions.push(
      `(include_brand_lower @> ARRAY['*'] OR include_brand_lower @> ARRAY[$${idx}]::text[])`
    )
    values.push(brandLower)
    idx++

    conditions.push(
      `(exclude_brand_lower IS NULL OR NOT (exclude_brand_lower @> ARRAY[$${idx}]::text[]))`
    )
    values.push(brandLower)
    idx++
  }

  if (params.city !== null) {
    conditions.push(`buyable_cities @> ARRAY[$${idx}]::text[]`)
    values.push(params.city)
    idx++
  }

  if (params.price !== 0) {
    conditions.push(`(price_range_from <= $${idx} AND price_range_to >= $${idx + 1})`)
    values.push(params.price, params.price)
    idx += 2
  }

  if (params.car_age !== -1) {
    conditions.push(`(car_age IS NULL OR car_age >= $${idx})`)
    values.push(params.car_age)
    idx++
  }

  if (params.mileage !== 0) {
    conditions.push(`(mileage_max IS NULL OR mileage_max >= $${idx})`)
    values.push(params.mileage)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const sql = `SELECT dealer_id FROM preference_view ${where}`

  const result = await query(sql, values)

  if (result.rows.length === 0) {
    console.log("[dealer-filter] No matching dealers, using defaults")
    return { dealer_ids: DEFAULT_DEALER_IDS, is_default: true }
  }

  const dealer_ids = result.rows.map((r: { dealer_id: string }) => r.dealer_id).filter(Boolean)
  console.log(`[dealer-filter] Found ${dealer_ids.length} matching dealers`)
  return { dealer_ids, is_default: false }
}
