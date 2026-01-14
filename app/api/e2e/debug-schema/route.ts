
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const result = await query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
    `)
        return NextResponse.json({ tables: result.rows })
    } catch (error) {
        return NextResponse.json({ error: String(error) })
    }
}
