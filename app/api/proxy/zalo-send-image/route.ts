import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log("[Zalo Proxy API] Received request:", {
      send_from_number: body.send_from_number,
      send_to_groupid: body.send_to_groupid,
      message: body.message?.substring(0, 100),
      imageCount: body.image_url?.length,
    })

    const {
      send_from_number,
      send_to_groupid,
      message,
      caption,
      image_url,
      action
    } = body

    if (!send_from_number || !send_to_groupid || !message) {
      return NextResponse.json(
        { error: "Missing required fields: send_from_number, send_to_groupid, message" },
        { status: 400 }
      )
    }

    const abitstoreUrl = "https://new.abitstore.vn/zalo/sendImageToGroupZalo/6/CaNhanTest/JumNkKmJQtMfB6s"

    const payload = {
      send_from_number,
      send_to_groupid,
      message,
      caption: caption || " ",
      image_url: image_url || [],
      action: action || ""
    }

    console.log("[Zalo Proxy API] Forwarding to abitstore:", abitstoreUrl)
    console.log("[Zalo Proxy API] Payload:", JSON.stringify(payload, null, 2))

    const response = await fetch(abitstoreUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log("[Zalo Proxy API] Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Zalo Proxy API] Error response:", errorText)
      return NextResponse.json(
        {
          error: "Failed to send to abitstore",
          details: errorText,
          status: response.status
        },
        { status: response.status }
      )
    }

    const responseData = await response.json()
    console.log("[Zalo Proxy API] Success response:", responseData)

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error("[Zalo Proxy API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
