import { NextRequest, NextResponse } from "next/server"

const VUCAR_API_SECRET = "vucar-rest-api-secret-2025-f8a3c9d1e4b6"
const VUCAR_API_BASE_URL = "https://api.vucar.vn"

// Valid stage enum values
const VALID_STAGES = [
    "CANNOT_CONTACT",
    "CONTACTED",
    "NEGOTIATION",
    "CAR_VIEW",
    "DEPOSIT_PAID",
    "COMPLETED",
    "FAILED",
    "UNDEFINED"
] as const

type SaleStage = typeof VALID_STAGES[number]

interface UpdateSaleStatusRequest {
    carId: string
    leadId?: string  // For activity logging
    saleStatusId?: string | null
    stage?: SaleStage
    price_customer?: number
    price_highest_bid?: number
    qualified?: string
    intentionLead?: string
    negotiationAbility?: string
    notes?: string
    // Previous values for activity logging
    previousValues?: {
        stage?: string | null
        price_customer?: number | null
        price_highest_bid?: number | null
        qualified?: string | null
        intentionLead?: string | null
        negotiationAbility?: string | null
        notes?: string | null
    }
}

// Helper to get activity type for a field
// Valid values: STATUS_UPDATED, NOTE_ADDED, TASK_CREATED, TASK_COMPLETED, CALL_LOGGED, 
// AUCTION_CREATED, INSPECTION_COMPLETED, CAR_VIEWED, PRICE_REPORT_USED, BOT_FOLLOW_UP_SENT, DECOY_SUMMARY
function getActivityType(field: string): string {
    if (field === 'notes') return 'NOTE_ADDED'
    // All other field updates use STATUS_UPDATED
    return 'STATUS_UPDATED'
}

// Helper to log a sale activity
async function logSaleActivity(
    leadId: string,
    field: string,
    previousValue: any,
    newValue: any
) {
    const payload = {
        leadId,
        activityType: getActivityType(field),
        metadata: {
            field_name: field,
            previous_value: previousValue ?? null,
            new_value: newValue,
        },
        actorType: "USER",
        field,
    }

    console.log(`[SALE_ACTIVITY] Sending activity for field: ${field}`, JSON.stringify(payload))

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
        console.log(`[SALE_ACTIVITY] Response for ${field}: status=${response.status}, body=${responseText}`)

        if (!response.ok) {
            console.error(`[SALE_ACTIVITY] API error for ${field}: ${response.status} - ${responseText}`)
        }
    } catch (error) {
        // Log error but don't fail the main request
        console.error(`[SALE_ACTIVITY] Failed to log activity for ${field}:`, error)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: UpdateSaleStatusRequest = await request.json()
        const { carId, leadId, saleStatusId, stage, price_customer, price_highest_bid, qualified, intentionLead, negotiationAbility, notes, previousValues } = body

        // Validate required fields
        if (!carId) {
            return NextResponse.json(
                { success: false, error: "carId is required" },
                { status: 400 }
            )
        }

        // saleStatusId is optional - if not provided, API will create new record

        // Validate stage if provided
        if (stage && !VALID_STAGES.includes(stage)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}`
                },
                { status: 400 }
            )
        }

        // Validate prices if provided
        if (price_customer !== undefined && (typeof price_customer !== "number" || price_customer < 0)) {
            return NextResponse.json(
                { success: false, error: "price_customer must be a number >= 0" },
                { status: 400 }
            )
        }

        if (price_highest_bid !== undefined && (typeof price_highest_bid !== "number" || price_highest_bid < 0)) {
            return NextResponse.json(
                { success: false, error: "price_highest_bid must be a number >= 0" },
                { status: 400 }
            )
        }

        // Build payload with only provided fields + required carId and optional id
        // Note: External API expects camelCase field names
        const payload: Record<string, any> = {
            carId: carId,
        }

        // Only include id if saleStatusId is provided (for update, not create)
        if (saleStatusId) {
            payload.id = saleStatusId
        }

        let hasChanges = false
        if (stage !== undefined) {
            payload.stage = stage
            hasChanges = true
        }
        if (price_customer !== undefined) {
            payload.priceCustomer = price_customer
            hasChanges = true
        }
        if (price_highest_bid !== undefined) {
            payload.priceHighestBid = price_highest_bid
            hasChanges = true
        }
        if (qualified !== undefined) {
            payload.qualified = qualified
            hasChanges = true
        }
        if (intentionLead !== undefined) {
            payload.intentionLead = intentionLead
            hasChanges = true
        }
        if (negotiationAbility !== undefined) {
            payload.negotiationAbility = negotiationAbility
            hasChanges = true
        }
        if (notes !== undefined) {
            payload.notes = notes
            hasChanges = true
        }

        // Check if there are any fields to update
        if (!hasChanges) {
            return NextResponse.json(
                { success: false, error: "No fields to update" },
                { status: 400 }
            )
        }

        console.log("[UPDATE_SALE_STATUS] Calling upsert API with payload:", JSON.stringify(payload))

        // Call external API - using POST /sale-status/upsert
        const response = await fetch(`${VUCAR_API_BASE_URL}/sale-status/upsert`, {
            method: "POST",
            headers: {
                "x-api-secret": VUCAR_API_SECRET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[UPDATE_SALE_STATUS] API error:", response.status, errorText)
            return NextResponse.json(
                {
                    success: false,
                    error: `API request failed: ${response.status}`,
                    details: errorText
                },
                { status: response.status }
            )
        }

        const data = await response.json()

        // Log sale activities for each changed field (non-blocking)
        if (leadId) {
            const prev = previousValues || {}
            const activityPromises: Promise<void>[] = []

            if (stage !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'stage', prev.stage, stage))
            }
            if (price_customer !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'priceCustomer', prev.price_customer, price_customer))
            }
            if (price_highest_bid !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'priceHighestBid', prev.price_highest_bid, price_highest_bid))
            }
            if (qualified !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'qualified', prev.qualified, qualified))
            }
            if (intentionLead !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'intentionLead', prev.intentionLead, intentionLead))
            }
            if (negotiationAbility !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'negotiationAbility', prev.negotiationAbility, negotiationAbility))
            }
            if (notes !== undefined) {
                activityPromises.push(logSaleActivity(leadId, 'notes', prev.notes, notes))
            }

            // Wait for all activity logging to complete (temporarily, for debugging)
            console.log(`[UPDATE_SALE_STATUS] Logging ${activityPromises.length} activities for leadId: ${leadId}`)
            await Promise.all(activityPromises)
            console.log(`[UPDATE_SALE_STATUS] Finished logging activities`)
        }

        return NextResponse.json({
            success: true,
            data,
        })
    } catch (error) {
        console.error("[UPDATE_SALE_STATUS] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        )
    }
}
