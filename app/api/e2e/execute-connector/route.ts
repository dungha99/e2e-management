import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { connectorName, payload } = body

    if (!connectorName || !payload) {
      return NextResponse.json(
        { error: "Missing required fields: connectorName and payload" },
        { status: 400 }
      )
    }

    // Step 1: Look up connector by ID or name
    let connectorResult;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectorName);

    if (isUuid) {
      connectorResult = await e2eQuery(
        `SELECT * FROM api_connectors WHERE id = $1 LIMIT 1`,
        [connectorName]
      )
    }

    if (!connectorResult || connectorResult.rows.length === 0) {
      connectorResult = await e2eQuery(
        `SELECT * FROM api_connectors WHERE name = $1 LIMIT 1`,
        [connectorName]
      )
    }

    if (connectorResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Connector "${connectorName}" not found` },
        { status: 404 }
      )
    }

    const connector = connectorResult.rows[0]
    let { base_url, method, auth_config } = connector

    console.log("[Execute Connector] Connector config:", {
      name: connector.name,
      base_url,
      method,
      auth_config_type: typeof auth_config,
      auth_config_raw: auth_config
    })

    // Parse auth_config if it's a string
    if (typeof auth_config === 'string') {
      try {
        auth_config = JSON.parse(auth_config)
        console.log("[Execute Connector] Parsed auth_config:", auth_config)
      } catch (e) {
        console.warn("[Execute Connector] Failed to parse auth_config string:", e)
      }
    }

    // Step 2: Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (auth_config && typeof auth_config === 'object') {
      console.log("[Execute Connector] Applying auth_config to headers")
      // Direct header mapping (if auth_config is a flat dictionary of headers)
      Object.entries(auth_config).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value
        }
      })

      // Support for legacy Bearer token structure
      if (auth_config.type === "bearer" && auth_config.token) {
        headers["Authorization"] = `Bearer ${auth_config.token}`
      }
    }

    console.log("[Execute Connector] Final headers (masked secrets):",
      Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, k.toLowerCase().includes('secret') || k.toLowerCase().includes('auth') ? '***' : v]))
    )

    // Step 3: Call the connector's URL
    console.log(`[Execute Connector] Calling ${connectorName}: ${method} ${base_url}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minutes

    const fetchOptions: RequestInit = {
      method: method || "POST",
      headers,
      signal: controller.signal,
    }

    // Only include body for methods that support it
    if (method !== "GET" && method !== "HEAD") {
      fetchOptions.body = JSON.stringify(payload)
    }

    try {
      const response = await fetch(base_url, fetchOptions)
      clearTimeout(timeoutId)

      const responseText = await response.text()
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        data = responseText
      }

      if (!response.ok) {
        console.error(`[Execute Connector] ${connectorName} returned ${response.status}:`, data)
        return NextResponse.json(
          {
            success: false,
            error: `Connector returned ${response.status}`,
            connectorName,
            response: data,
          },
          { status: 500 }
        )
      }

      console.log(`[Execute Connector] ${connectorName} called successfully`)

      return NextResponse.json({
        success: true,
        connectorName,
        response: data,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      const errorMessage = err instanceof Error && err.name === 'AbortError'
        ? 'Connector execution timed out after 5 minutes'
        : (err instanceof Error ? err.message : String(err))

      console.error("[Execute Connector] Fetch Error:", err)
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          connectorName,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Execute Connector] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute connector",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
