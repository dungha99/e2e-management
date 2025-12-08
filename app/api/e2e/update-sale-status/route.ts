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
    saleStatusId: string
    stage?: SaleStage
    price_customer?: number
    price_highest_bid?: number
}

export async function POST(request: NextRequest) {
    try {
        const body: UpdateSaleStatusRequest = await request.json()
        const { saleStatusId, stage, price_customer, price_highest_bid } = body

        // Validate required field
        if (!saleStatusId) {
            return NextResponse.json(
                { success: false, error: "saleStatusId is required" },
                { status: 400 }
            )
        }

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

        // Build payload with only provided fields
        // Note: External API expects camelCase field names
        const payload: Record<string, any> = {}
        if (stage !== undefined) payload.stage = stage
        if (price_customer !== undefined) payload.priceCustomer = price_customer
        if (price_highest_bid !== undefined) payload.priceHighestBid = price_highest_bid

        // If no fields to update, return error
        if (Object.keys(payload).length === 0) {
            return NextResponse.json(
                { success: false, error: "No fields to update" },
                { status: 400 }
            )
        }

        // Call external API
        const response = await fetch(`${VUCAR_API_BASE_URL}/sale-status/${saleStatusId}`, {
            method: "PATCH",
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
