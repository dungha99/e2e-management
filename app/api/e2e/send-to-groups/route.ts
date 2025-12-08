import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { groupIds, message, imageUrls, phone } = body

    console.log("[Send to Groups API] Received request:", {
      groupIds,
      message: message.substring(0, 100),
      imageCount: imageUrls?.length,
      phone
    })

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return NextResponse.json({ error: "Group IDs are required" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const sendDynamicKey = process.env.ZALO_SEND_DYNAMIC_KEY

    if (!sendDynamicKey) {
      return NextResponse.json(
        { error: "Zalo send API credentials not configured" },
        { status: 500 }
      )
    }

    console.log("[Send to Groups API] Dynamic key loaded:", sendDynamicKey.substring(0, 5) + "...")

    const results = []

    // Send message and images to each group
    for (const groupId of groupIds) {
      console.log("[Send to Groups API] Processing group:", groupId)
      try {
        // Send message with all images in a single request
        const payload = {
          send_from_number: "84965670787",
          send_to_groupid: groupId,
          message: message,
          caption: " ",
          image_url: imageUrls && imageUrls.length > 0 ? imageUrls : [],
          action: ""
        }

        console.log("[Send to Groups API] Payload:", JSON.stringify(payload, null, 2))

        const response = await fetch(
          `https://new.abitstore.vn/zalo/sendImageToGroupZalo/6/CaNhanTest/${sendDynamicKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        )

        console.log(`[Send to Groups API] Response status:`, response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[Send to Groups API] Error response:`, errorText)
          throw new Error(`Failed to send to group ${groupId}: ${errorText}`)
        }

        const responseData = await response.json()
        console.log(`[Send to Groups API] Success response:`, responseData)

        results.push({
          groupId,
          success: true
        })
      } catch (error) {
        console.error(`[Send to Groups] Error sending to group ${groupId}:`, error)
        results.push({
          groupId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.length - successCount

    return NextResponse.json({
      success: failedCount === 0,
      successCount,
      failedCount,
      results
    })
  } catch (error) {
    console.error("[Send to Groups API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to send to groups",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
