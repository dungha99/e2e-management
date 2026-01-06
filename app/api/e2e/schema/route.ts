import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

// Interface for table info
interface TableInfo {
    table_name: string
    table_type: string
}

// Interface for column info
interface ColumnInfo {
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    character_maximum_length: number | null
}

// Interface for constraint info
interface ConstraintInfo {
    constraint_name: string
    constraint_type: string
    column_name: string
    foreign_table_name: string | null
    foreign_column_name: string | null
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const tableName = searchParams.get("table")

        if (tableName) {
            // Get columns for specific table
            const columnsResult = await e2eQuery(
                `SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
                [tableName]
            )

            // Get constraints for specific table
            const constraintsResult = await e2eQuery(
                `SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1`,
                [tableName]
            )

            // Get row count
            const countResult = await e2eQuery(
                `SELECT COUNT(*) as count FROM "${tableName}"`
            )

            return NextResponse.json({
                success: true,
                table: tableName,
                columns: columnsResult.rows as ColumnInfo[],
                constraints: constraintsResult.rows as ConstraintInfo[],
                rowCount: parseInt(countResult.rows[0]?.count || "0"),
            })
        }

        // Get all tables in public schema
        const tablesResult = await e2eQuery(
            `SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`
        )

        // Get row counts for each table
        const tables = tablesResult.rows as TableInfo[]
        const tablesWithCounts = await Promise.all(
            tables.map(async (table) => {
                try {
                    const countResult = await e2eQuery(
                        `SELECT COUNT(*) as count FROM "${table.table_name}"`
                    )
                    return {
                        ...table,
                        row_count: parseInt(countResult.rows[0]?.count || "0"),
                    }
                } catch {
                    return {
                        ...table,
                        row_count: 0,
                    }
                }
            })
        )

        return NextResponse.json({
            success: true,
            tables: tablesWithCounts,
        })
    } catch (error) {
        console.error("[E2E API] Error fetching schema:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch schema",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}
