import { NextResponse } from "next/server"
import { getCached } from "@/lib/cache"

const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const phone = searchParams.get("phone")

        if (!phone) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
        }

        const nocache = searchParams.get("nocache")
        const cacheKey = `sale-activities:${phone}`
        const cacheTTL = nocache ? 0 : 10 // 10 seconds cache, or no cache if nocache param

        const saleActivities = await getCached(
            cacheKey,
            async () => {
                // Fetch from Vucar API - only use phone parameter
                const response = await fetch(
                    `https://api.vucar.vn/sale-activities?phone=${encodeURIComponent(phone)}`,
                    {
                        headers: {
                            "x-api-secret": VUCAR_API_SECRET,
                        },
                    }
                )

                if (!response.ok) {
                    console.log("[Sale Activities API] Vucar API response not OK:", response.status)
                    return []
                }

                const data = await response.json()
                // API returns { success: true, activities: [...] }
                if (data && data.success && Array.isArray(data.activities)) {
                    return data.activities
                }
                // Fallback for other formats
                if (Array.isArray(data)) {
                    return data
                }
                return []
            },
            cacheTTL
        )

        return NextResponse.json(saleActivities)
    } catch (error) {
        console.error("[Sale Activities API] Error fetching sale activities:", error)
        return NextResponse.json({ error: "Failed to fetch sale activities" }, { status: 500 })
    }
}
