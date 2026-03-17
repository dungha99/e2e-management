import { NextResponse } from "next/server"

const URL = "https://crm-vucar-api.vucar.vn/api/v1/lead-monitor/dashboard/sla-breach-rate"

export async function GET() {
  try {
    const res = await fetch(URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    })
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error("[Lead Monitor] Error fetching SLA breach rate:", error)
    return NextResponse.json({ error: "Failed to fetch SLA breach rate" }, { status: 500 })
  }
}
