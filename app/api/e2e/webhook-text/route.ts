import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_URL = "https://n8n.vucar.vn/webhook/783efc4b-2acf-4715-ae8d-dcb9393695f0";

export async function POST(req: NextRequest) {
  try {
    const { text, senderName } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          from: { display_name: senderName || "Khả Nhi Vucar" },
          text: text,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook Text API Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send webhook text" },
      { status: 500 }
    );
  }
}
