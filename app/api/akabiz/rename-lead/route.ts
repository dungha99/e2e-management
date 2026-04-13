import { NextResponse } from "next/server";
import { vucarV2Query, e2eQuery } from "@/lib/db";
import { upsertZaloAction } from "@/lib/akabiz/upsertZaloAction";

// Same connector as send-customer-message — holds bearer token for zl.vucar.vn
const VUCAR_FRIENDS_CONNECTOR_ID = "a1b8debd-7e9d-45d4-8804-cb817d5504f5";

export async function POST(request: Request) {
  let car_id: string | undefined;
  let phone_number: string | undefined;
  let actionRecorded = false;

  try {
    const body = await request.json();
    car_id = body.car_id;
    phone_number = body.phone_number;

    console.log(
      "[Rename Lead] car_id:",
      car_id,
      "| phone_number:",
      phone_number,
    );

    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 },
      );
    }

    // ── Look up lead + car from CRM DB ───────────────────────────────────────
    const whereClause = car_id
      ? "c.id = $1"
      : "(l.phone = $1 OR l.additional_phone = $1)";
    const param = car_id ?? phone_number;

    const dbResult = await vucarV2Query(
      `SELECT
         l.id             AS lead_id,
         l.phone          AS lead_phone,
         l.zalo_account,
         c.id             AS car_id,
         c.model
       FROM leads l
       JOIN cars c ON c.lead_id = l.id AND c.is_deleted = false
       WHERE ${whereClause}
       ORDER BY l.created_at DESC, c.created_at DESC
       LIMIT 1`,
      [param],
    );

    if (!dbResult.rows.length) {
      return NextResponse.json({ error: "No lead/car found" }, { status: 404 });
    }

    const row = dbResult.rows[0];
    car_id = row.car_id;
    const resolvedPhone: string = row.lead_phone ?? phone_number;

    const { zalo_account, model } = row;

    if (!zalo_account) {
      return NextResponse.json(
        { error: "No zalo_account linked to this lead" },
        { status: 422 },
      );
    }

    // ── Parse ownId from "ownId:threadId" ────────────────────────────────────
    const [ownId] = (zalo_account as string).split(":");

    if (!ownId) {
      return NextResponse.json(
        { error: `Invalid zalo_account format: "${zalo_account}"` },
        { status: 422 },
      );
    }

    // ── Build alias: "{car.model} - {lead.phone}" ────────────────────────────
    const alias = `${model ?? "Unknown"} - ${resolvedPhone}`;

    // ── Fetch bearer token from connector ────────────────────────────────────
    const connectorResult = await e2eQuery(
      `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_FRIENDS_CONNECTOR_ID],
    );

    if (!connectorResult.rows.length) {
      return NextResponse.json(
        { error: `Connector ${VUCAR_FRIENDS_CONNECTOR_ID} not found` },
        { status: 500 },
      );
    }

    let { auth_config } = connectorResult.rows[0];
    if (typeof auth_config === "string") {
      try {
        auth_config = JSON.parse(auth_config);
      } catch {
        /* keep raw */
      }
    }

    let bearerToken: string | null = null;
    if (auth_config?.type === "bearer" && auth_config?.token) {
      bearerToken = auth_config.token;
    } else if (auth_config?.Authorization) {
      bearerToken = (auth_config.Authorization as string).replace(
        /^Bearer\s+/i,
        "",
      );
    } else if (auth_config?.authorization) {
      bearerToken = (auth_config.authorization as string).replace(
        /^Bearer\s+/i,
        "",
      );
    }

    if (!bearerToken) {
      return NextResponse.json(
        { error: "No bearer token in connector config" },
        { status: 500 },
      );
    }

    const url = `https://zl.vucar.vn/api/accounts/${ownId}/friends/alias-by-phone`;

    console.log("[Rename Lead] PUT", url, "| alias:", alias);

    // ── PUT alias-by-phone on Zalo ───────────────────────────────────────────
    const zaloRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        account_id: ownId,
        phone: resolvedPhone,
        alias,
      }),
    });

    const zaloData = (await zaloRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    // ── Record action ─────────────────────────────────────────────────────────
    const status = zaloRes.ok ? "success" : "failed";
    await upsertZaloAction(car_id!, resolvedPhone, "rename", status, {
      alias,
      phone: resolvedPhone,
      zalo_status: zaloRes.status,
      reason: zaloRes.ok
        ? "Đổi tên lead thành công"
        : `Zalo API returned ${zaloRes.status}`,
    });
    actionRecorded = true;

    if (!zaloRes.ok) {
      console.error("[Rename Lead] Zalo API error:", zaloRes.status, zaloData);
      return NextResponse.json(
        { error: "Zalo API returned an error", detail: zaloData },
        { status: zaloRes.status },
      );
    }

    return NextResponse.json({
      success: true,
      account_id: ownId,
      phone: resolvedPhone,
      alias,
      car_id,
      lead_id: row.lead_id,
      data: zaloData,
    });
  } catch (error) {
    console.error("[Rename Lead] Caught error:", error);

    if (car_id && phone_number && !actionRecorded) {
      await upsertZaloAction(car_id, phone_number, "rename", "failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    if (!car_id) {
      console.warn(
        "[Rename Lead] Không thể ghi DB — car_id missing. phone:",
        phone_number,
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to rename lead",
      },
      { status: 500 },
    );
  }
}
