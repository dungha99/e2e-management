import { NextResponse } from "next/server";
import { followupDataQuery } from "@/lib/db";

// Default messages for each account
const DEFAULT_MESSAGES: Record<string, string> = {
  "Hùng Taxi":
    "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ?",
  "Huy Hồ":
    "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
  "Minh Anh":
    "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
};

// Account codes derived from names
const ACCOUNT_CODES: Record<string, string> = {
  "Hùng Taxi": "HT",
  "Huy Hồ": "HH",
  "Minh Anh": "MA",
};

export async function GET() {
  try {
    // Query the staffs table from followup_data database
    const result = await followupDataQuery(
      `SELECT name, shop_id
       FROM staffs
       WHERE name IN ('Huy Hồ', 'Minh Anh', 'Hùng Taxi')
       ORDER BY name ASC`,
      []
    );

    const accounts = result.rows.map((row) => ({
      name: row.name,
      account:
        ACCOUNT_CODES[row.name] || row.name.substring(0, 2).toUpperCase(),
      shop_id: row.shop_id,
      default_message: DEFAULT_MESSAGES[row.name] || "",
    }));

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("[Decoy Accounts API] Error fetching decoy accounts:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch decoy accounts",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
