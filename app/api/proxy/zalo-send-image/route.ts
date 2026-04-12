import { NextResponse } from "next/server"
import { enqueueMessage } from "@/lib/zalo-queue"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      groupname,
      message,
      caption,
      image_url,
      action,
      pic_id,
    } = body

    console.log("[Zalo Proxy API] Received request:", {
      groupname,
      message: message?.substring(0, 100),
      imageCount: image_url?.length,
    })

    if (!message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      )
    }

    if (!groupname) {
      return NextResponse.json(
        { error: "Missing required field: groupname" },
        { status: 400 }
      )
    }

    // Enqueue — group_id will be resolved at send time per account
    const { queueId } = await enqueueMessage({
      group_name: groupname,
      message,
      caption,
      image_url,
      action,
      pic_id,
    })

    console.log("[Zalo Proxy API] Message enqueued:", { queueId, groupname })

    return NextResponse.json(
      { success: true, queued: true, queue_id: queueId, group_name: groupname },
      { status: 202 }
    )

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
