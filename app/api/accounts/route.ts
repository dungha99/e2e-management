import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function GET() {
  try {
    // Query the users table from VuCar V2 database
    const result = await vucarV2Query(
      `SELECT id, user_name
       FROM users
       ORDER BY user_name ASC`,
      []
    )

    // Transform to match the Account interface format
    const accounts = result.rows.map((user) => ({
      name: user.user_name,
      uid: user.id,
    }))

    return NextResponse.json(accounts)
  } catch (error) {
    console.error("[Accounts API] Error fetching accounts:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to fetch accounts",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
