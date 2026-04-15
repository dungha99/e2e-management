import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const carId = searchParams.get("car_id")

  if (!carId) {
    return NextResponse.json({ error: "car_id is required" }, { status: 400 })
  }

  try {
    const result = await vucarV2Query(
      `SELECT
         c.id AS car_id,
         c.brand,
         c.model,
         c.variant,
         c.year,
         c.location,
         c.mileage,
         c.additional_images,
         ss.price_customer,
         u.user_name AS pic_name
       FROM cars c
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN users u ON u.id = l.pic_id
       WHERE c.id = $1
       LIMIT 1`,
      [carId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    const row = result.rows[0]

    // Parse additional_images
    let additionalImages: Record<string, Array<{ url: string }>> = {}
    if (row.additional_images) {
      try {
        additionalImages =
          typeof row.additional_images === "string"
            ? JSON.parse(row.additional_images)
            : row.additional_images
      } catch {
        additionalImages = {}
      }
    }

    // Build image_urls (same order as the dialog)
    const imageUrls: string[] = []
    Object.values(additionalImages).forEach((images) => {
      if (Array.isArray(images)) {
        images.forEach((img) => {
          if (img.url) imageUrls.push(img.url)
        })
      }
    })

    // Build message (same format as the dialog)
    const now = new Date()
    const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")} ${now.getDate().toString().padStart(2, "0")}/${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${now.getFullYear()}`

    const carName = `${row.brand || ""} ${row.model || ""} ${row.variant || ""} ${
      row.year || ""
    }`.trim()

    const priceCustomer = row.price_customer
    const priceText =
      priceCustomer && parseInt(String(priceCustomer)) > 1000
        ? `${parseInt(String(priceCustomer)) / 1000000}tr`
        : "Chưa có giá mong muốn"

    const message = [
      "GỬI DEALER",
      `Thời gian nhận thông tin: ${timeString}`,
      `Thông tin chi tiết xe: ${carName}`,
      `Số km đã đi (Odo): ${row.mileage ? Number(row.mileage).toLocaleString() : "N/A"} km`,
      `Khu vực: ${row.location || "N/A"}`,
      `Giá mong muốn: ${priceText}`,
      "-----------------------------------",
      `Mã tin xe: ${row.car_id}`,
      `Tin chi tiết: https://tinxe.vucar.vn/car/${row.car_id}?utm_source=zalo-mess&utm_campaign=gui-tin-xe`,
      `Sale phụ trách: ${row.pic_name || "N/A"}`,
    ].join("\n")

    return NextResponse.json({ message, image_urls: imageUrls })
  } catch (error) {
    console.error("[dealer-message-preview] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to build message preview",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
