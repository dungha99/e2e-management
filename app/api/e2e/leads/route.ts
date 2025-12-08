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
      `SELECT * FROM (
        SELECT DISTINCT ON (l.phone)
          l.id, l.name, l.phone, l.identify_number, l.bank_account_number, l.otp_verified,
          l.created_at, l.pic_id, l.pic_og, l.source, l.url, l.additional_phone,
          l.qx_qc_scoring, l.customer_feedback, l.is_referral,
          c.id as car_id
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        WHERE l.pic_id = $1
          AND c.created_at > NOW() - INTERVAL '2 months'
        ORDER BY l.phone, l.created_at DESC, c.created_at DESC NULLS LAST
      ) AS subquery
      ORDER BY created_at DESC`,
      [uid]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("[E2E API] Error fetching leads:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}
