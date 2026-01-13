import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

// Whitelist of allowed tables to prevent SQL injection
const ALLOWED_TABLES = [
    "workflows",
    "workflow_stages",
    "workflow_steps",
    "workflow_instances",
    "workflow_transitions",
    "step_executions",
]

// Field configurations for each table
const TABLE_FIELDS: Record<string, {
    required: string[];
    optional: string[];
    generated: string[];
}> = {
    workflows: {
        required: ["name", "stage_id", "sla_hours"],
        optional: ["description", "is_active", "tooltip"],
        generated: ["id"],
    },
    workflow_stages: {
        required: ["name"],
        optional: [],
        generated: ["id"],
    },
    workflow_steps: {
        required: ["workflow_id", "step_name", "step_order"],
        optional: ["is_automated"],
        generated: ["id"],
    },
    workflow_instances: {
        required: ["car_id", "workflow_id"],
        optional: ["parent_instance_id", "current_step_id", "status", "final_outcome", "sla_deadline"],
        generated: ["id", "started_at"],
    },
    workflow_transitions: {
        required: ["from_workflow_id", "to_workflow_id"],
        optional: ["condition_logic", "priority", "transition_sla_hours"],
        generated: ["id"],
    },
    step_executions: {
        required: ["instance_id", "step_id"],
        optional: ["status", "error_message"],
        generated: ["id", "executed_at"],
    },
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ tableName: string }> }
) {
    try {
        const { tableName } = await params
        const { searchParams } = new URL(request.url)
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
        const offset = parseInt(searchParams.get("offset") || "0")
        const orderBy = searchParams.get("orderBy") || "id"
        const orderDir = searchParams.get("orderDir") === "asc" ? "ASC" : "DESC"

        if (!ALLOWED_TABLES.includes(tableName)) {
            return NextResponse.json(
                { success: false, error: `Table "${tableName}" is not accessible.` },
                { status: 403 }
            )
        }

        const countResult = await e2eQuery(`SELECT COUNT(*) as count FROM "${tableName}"`)
        const totalCount = parseInt(countResult.rows[0]?.count || "0")

        const columnsResult = await e2eQuery(
            `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1`,
            [tableName]
        )
        const validColumns = columnsResult.rows.map((r: { column_name: string }) => r.column_name)
        const safeOrderBy = validColumns.includes(orderBy) ? orderBy : "id"

        const dataResult = await e2eQuery(
            `SELECT * FROM "${tableName}" ORDER BY "${safeOrderBy}" ${orderDir} LIMIT $1 OFFSET $2`,
            [limit, offset]
        )

        return NextResponse.json({
            success: true,
            table: tableName,
            data: dataResult.rows,
            pagination: {
                limit,
                offset,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: Math.floor(offset / limit) + 1,
            },
            columns: validColumns,
            fieldConfig: TABLE_FIELDS[tableName] || { required: [], optional: [], generated: [] },
        })
    } catch (error) {
        console.error("[E2E API] Error fetching table data:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch table data", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// CREATE - Insert new record
export async function POST(
    request: Request,
    { params }: { params: Promise<{ tableName: string }> }
) {
    try {
        const { tableName } = await params
        const body = await request.json()

        if (!ALLOWED_TABLES.includes(tableName)) {
            return NextResponse.json(
                { success: false, error: `Table "${tableName}" is not accessible.` },
                { status: 403 }
            )
        }

        const fieldConfig = TABLE_FIELDS[tableName]
        if (!fieldConfig) {
            return NextResponse.json(
                { success: false, error: `Table "${tableName}" configuration not found.` },
                { status: 400 }
            )
        }

        // Validate required fields
        const missingFields = fieldConfig.required.filter(field => !body[field] && body[field] !== false && body[field] !== 0)
        if (missingFields.length > 0) {
            return NextResponse.json(
                { success: false, error: `Missing required fields: ${missingFields.join(", ")}` },
                { status: 400 }
            )
        }

        // Build insert query
        const allowedFields = [...fieldConfig.required, ...fieldConfig.optional]
        const fieldsToInsert = allowedFields.filter(field => body[field] !== undefined)
        const values = fieldsToInsert.map(field => body[field])
        const placeholders = fieldsToInsert.map((_, i) => `$${i + 1}`)

        const query = `
      INSERT INTO "${tableName}" (${fieldsToInsert.map(f => `"${f}"`).join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `

        const result = await e2eQuery(query, values)

        return NextResponse.json({
            success: true,
            message: "Record created successfully",
            data: result.rows[0],
        })
    } catch (error) {
        console.error("[E2E API] Error creating record:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create record", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// UPDATE - Update existing record
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ tableName: string }> }
) {
    try {
        const { tableName } = await params
        const body = await request.json()
        const { id, ...updateData } = body

        if (!ALLOWED_TABLES.includes(tableName)) {
            return NextResponse.json(
                { success: false, error: `Table "${tableName}" is not accessible.` },
                { status: 403 }
            )
        }

        if (!id) {
            return NextResponse.json(
                { success: false, error: "ID is required for update" },
                { status: 400 }
            )
        }

        const fieldConfig = TABLE_FIELDS[tableName]
        const allowedFields = [...(fieldConfig?.required || []), ...(fieldConfig?.optional || [])]
        const fieldsToUpdate = Object.keys(updateData).filter(
            field => allowedFields.includes(field) && updateData[field] !== undefined
        )

        if (fieldsToUpdate.length === 0) {
            return NextResponse.json(
                { success: false, error: "No valid fields to update" },
                { status: 400 }
            )
        }

        const setClause = fieldsToUpdate.map((field, i) => `"${field}" = $${i + 1}`).join(", ")
        const values = [...fieldsToUpdate.map(field => updateData[field]), id]

        const query = `
      UPDATE "${tableName}"
      SET ${setClause}
      WHERE id = $${fieldsToUpdate.length + 1}
      RETURNING *
    `

        const result = await e2eQuery(query, values)

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Record not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Record updated successfully",
            data: result.rows[0],
        })
    } catch (error) {
        console.error("[E2E API] Error updating record:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update record", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Delete a record
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ tableName: string }> }
) {
    try {
        const { tableName } = await params
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!ALLOWED_TABLES.includes(tableName)) {
            return NextResponse.json(
                { success: false, error: `Table "${tableName}" is not accessible.` },
                { status: 403 }
            )
        }

        if (!id) {
            return NextResponse.json(
                { success: false, error: "ID is required for deletion" },
                { status: 400 }
            )
        }

        const result = await e2eQuery(
            `DELETE FROM "${tableName}" WHERE id = $1 RETURNING id`,
            [id]
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Record not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Record deleted successfully",
            deletedId: id,
        })
    } catch (error) {
        console.error("[E2E API] Error deleting record:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete record", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}
