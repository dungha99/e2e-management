import { NextResponse } from "next/server";
import { storeAgentOutput } from "@/lib/ai-agent-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentName, carId, sourceInstanceId, inputPayload, outputPayload } = body;

    // Basic validation
    if (!agentName || !carId || outputPayload === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: agentName, carId, or outputPayload" },
        { status: 400 }
      );
    }

    const result = await storeAgentOutput({
      agentName,
      carId,
      sourceInstanceId,
      inputPayload,
      outputPayload
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, outputId: result.outputId });
  } catch (error) {
    console.error("[POST /api/e2e/ai-agents/outputs] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
