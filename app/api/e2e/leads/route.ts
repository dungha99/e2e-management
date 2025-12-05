import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    const result = await vucarV2Query(
      `SELECT DISTINCT ON (l.id)
        l.id, l.name, l.phone, l.identify_number, l.bank_account_number, l.otp_verified,
        l.created_at, l.pic_id, l.pic_og, l.source, l.url, l.additional_phone,
        l.qx_qc_scoring, l.customer_feedback, l.is_referral,
        c.id as car_id, c.created_at as car_created_at
       FROM leads l
       LEFT JOIN cars c ON c.lead_id = l.id
       WHERE l.pic_id = $1
         AND l.created_at > NOW() - INTERVAL '2 months'
       ORDER BY l.id, c.created_at DESC NULLS LAST, l.created_at DESC`,
      [uid]
    )

    // Sort the results by car creation date (latest first)
    const sortedRows = result.rows.sort((a: any, b: any) => {
      const dateA = a.car_created_at ? new Date(a.car_created_at).getTime() : 0
      const dateB = b.car_created_at ? new Date(b.car_created_at).getTime() : 0
      return dateB - dateA // Descending order (latest first)
    })

    return NextResponse.json(sortedRows)
  } catch (error) {
    console.error("[E2E API] Error fetching leads:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}
