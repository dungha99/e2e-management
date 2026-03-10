import { NextResponse } from "next/server";
import { followupDataQuery } from "@/lib/db";

// Cache for valid shop IDs to avoid frequent database queries
let cachedValidShopIds: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getValidShopIds(): Promise<string[]> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedValidShopIds && now - cacheTimestamp < CACHE_DURATION) {
    return cachedValidShopIds;
  }

  // Fetch from database
  try {
    const result = await followupDataQuery(
      `SELECT shop_id FROM staffs WHERE name IN ('Huy Hồ', 'Minh Anh', 'Hùng Taxi')`,
      []
    );
    cachedValidShopIds = result.rows.map((row) => row.shop_id);
    cacheTimestamp = now;
    return cachedValidShopIds;
  } catch (error) {
    console.error(
      "[Get Chat History API] Error fetching valid shop IDs:",
      error
    );
    // Fallback to hardcoded values if database query fails
    return [
      "68ff3282-a3cd-ba1d-a71a-1b7100000000", // Hùng Taxi
      "31240d1a-a079-43ed-8c21-c8a18269b014", // Huy Hồ
      "68f5f0f9-0703-9cf6-ae45-81e800000000", // Minh Anh
    ];
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, shop_id } = body;

    if (!phone || !shop_id) {
      return NextResponse.json(
        { error: "phone and shop_id are required" },
        { status: 400 }
      );
    }

    const validShopIds = await getValidShopIds();
    if (!validShopIds.includes(shop_id)) {
      return NextResponse.json({ error: "Invalid shop_id" }, { status: 400 });
    }

    console.log("[Get Chat History API] Fetching chat history:", {
      phone,
      shop_id,
    });

    let data: any = null;
    let fallbackError: any = null;
    let resOk = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          "https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ phone, shop_id }),
          }
        );

        if (response.ok) {
          const respData = await response.json();
          if (respData.is_successful !== false) {
            data = respData;
            resOk = true;
            break;
          }
        }

        console.warn(`[Get Chat History API] CRM API failed or is_successful=false (attempt ${attempt})`);
        if (attempt < 3) await new Promise((res) => setTimeout(res, 2000));
      } catch (err: any) {
        fallbackError = err;
        console.error(`[Get Chat History API] Fetch error on attempt ${attempt}:`, err);
        if (attempt < 3) await new Promise((res) => setTimeout(res, 2000));
      }
    }

    if (!resOk || !data) {
      console.error("[Get Chat History API] CRM API failed after 3 retries");
      throw new Error(fallbackError?.message || `CRM API failed after 3 retries`);
    }

    console.log("[Get Chat History API] Success:", {
      is_successful: data.is_successful,
      phone: data.phone,
      shop_id: data.shop_id,
      message_count: data.chat_history?.length || 0,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Get Chat History API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get chat history" },
      { status: 500 }
    );
  }
}
