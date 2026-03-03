import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await e2eQuery(`CREATE TABLE IF NOT EXISTS ai_process_blacklist (
      car_id UUID PRIMARY KEY, 
      created_at TIMESTAMP DEFAULT NOW()
    );`);
    return NextResponse.json({ success: true, message: "Table created" });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
