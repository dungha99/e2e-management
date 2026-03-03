import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/e2e/ai-process-status/[carId]
 * Check if the car is blacklisted from scheduled AI processing
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ carId: string }> }
) {
  try {
    const { carId } = await params;
    if (!carId) {
      return NextResponse.json({ success: false, error: "Missing carId" }, { status: 400 });
    }

    const result = await e2eQuery(
      `SELECT car_id FROM ai_process_blacklist WHERE car_id = $1`,
      [carId]
    );

    return NextResponse.json({ success: true, isBlacklisted: result.rows.length > 0 });
  } catch (error) {
    console.error(`[AI Process Status API] Error checking status:`, error);
    // Explicitly fallback to non-blacklisted state on error so we don't break UI
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/e2e/ai-process-status/[carId]
 * Toggle the blacklist status for a carId
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ carId: string }> }
) {
  try {
    const { carId } = await params;

    if (!carId) {
      return NextResponse.json({ success: false, error: "Missing carId" }, { status: 400 });
    }

    const { action } = await request.json(); // { action: "deactivate" | "rerun" }

    if (action === "deactivate") {
      // Add to blacklist
      await e2eQuery(
        `INSERT INTO ai_process_blacklist (car_id, created_at) VALUES ($1, NOW()) ON CONFLICT (car_id) DO NOTHING`,
        [carId]
      );
      return NextResponse.json({ success: true, isBlacklisted: true });
    } else if (action === "rerun") {
      // Remove from blacklist
      await e2eQuery(
        `DELETE FROM ai_process_blacklist WHERE car_id = $1`,
        [carId]
      );
      return NextResponse.json({ success: true, isBlacklisted: false });
    } else {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error(`[AI Process Status API] Error toggling status:`, error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
