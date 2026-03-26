import { NextResponse } from "next/server";
import { searchPicRAG } from "@/lib/pic-rag-search";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pic_id, chat_content } = body;

    if (!chat_content || typeof chat_content !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid chat_content" },
        { status: 400 }
      );
    }

    const results = await searchPicRAG(pic_id || null, chat_content, 5);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[PIC Vector Search] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Vector search failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
