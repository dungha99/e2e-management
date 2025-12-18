import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(req: Request) {
    try {
        const { lead_id, fourDigits, firstMessage } = await req.json()

        // Validate required fields
        if (!lead_id) {
            return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
        }

        if (!fourDigits || !/^\d{4}$/.test(fourDigits)) {
            return NextResponse.json({ error: "Vui lòng nhập đúng 4 số cuối điện thoại" }, { status: 400 })
        }

        // 1. Get phone number from lead
        const leadResult = await vucarV2Query(
            `SELECT phone, additional_phone
       FROM leads
       WHERE id = $1
       LIMIT 1`,
            [lead_id]
        )

        if (leadResult.rows.length === 0) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 })
        }

        const phone = leadResult.rows[0].phone || leadResult.rows[0].additional_phone

        if (!phone) {
            return NextResponse.json({ error: "Lead không có số điện thoại" }, { status: 400 })
        }

        // 2. Find auth_user with name equal to phone
        const authUserResult = await vucarV2Query(
            `SELECT id
       FROM auth_user
       WHERE name = $1
       LIMIT 1`,
            [phone]
        )

        if (authUserResult.rows.length === 0) {
            return NextResponse.json({ error: "Không tìm thấy auth_user cho số điện thoại này" }, { status: 404 })
        }

        const userId = authUserResult.rows[0].id

        // 3. Format senderName
        const senderName = `******${fourDigits}`

        // 4. Call external Vucar API
        const endpoint = "https://api.vucar.vn/chats/thread"
        const apiKey = process.env.VUCAR_API_SECRET || ""

        const payload = {
            userId: userId,
            metadata: {
                senderName: senderName,
                firstMessage: firstMessage || "Hello"
            }
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "x-api-secret": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        const result = await response.json()

        // Log the actual response for debugging
        console.log("[Create Thread API] External API response:", JSON.stringify(result))

        // Handle API response - check multiple possible response formats
        // Format 1: Array with success object [{success: true, data: {...}}]
        // Format 2: Direct success object {success: true, data: {...}}
        // Format 3: Direct data object without success wrapper

        let success = false
        let threadData = null

        if (Array.isArray(result) && result[0]?.success) {
            success = true
            threadData = result[0].data
        } else if (result?.success) {
            success = true
            threadData = result.data
        } else if (result?.id) {
            // Direct thread object returned
            success = true
            threadData = result
        }

        if (success) {
            return NextResponse.json({
                success: true,
                thread: threadData
            })
        } else {
            console.error("[Create Thread API] External API error:", result)
            return NextResponse.json({ error: "Không thể tạo thread" }, { status: 500 })
        }
    } catch (error) {
        console.error("[Create Thread API] Error:", error)
        return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
    }
}
