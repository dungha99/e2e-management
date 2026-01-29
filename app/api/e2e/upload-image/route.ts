import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ID || "",
    secretAccessKey: process.env.AWS_SECRET || "",
  },
});

const BUCKET_NAME = "vucar-ai";
const WEBHOOK_URL = "https://n8n.vucar.vn/webhook/783efc4b-2acf-4715-ae8d-dcb9393695f0";

export const maxDuration = 60; // Set timeout to 60 seconds

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      return NextResponse.json({ error: "File too large. Please select a smaller image." }, { status: 413 });
    }

    const file = formData.get("file") as File;
    const phone = formData.get("phone") as string;
    const displayName = formData.get("displayName") as string;
    const senderName = (formData.get("senderName") as string) || "Khả Nhi Vucar";
    const index = formData.get("index") as string || "1";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    // 1. Upload image to S3
    const buffer = Buffer.from(await file.arrayBuffer());

    // Sanitizing displayName for filename
    const safeDisplayName = (displayName || "unknown").trim().replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `InspectionImage/${phone}-${safeDisplayName}-${index}.jpg`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: file.type || "image/jpeg",
      })
    );

    const url = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/${fileName}`;

    // 2. Send image link to webhook
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            from: { display_name: senderName },
            photo_url: url,
          },
        }),
      });
    } catch (webhookError) {
      console.error("[Webhook Error] Failed to send image link:", url, webhookError);
    }

    return NextResponse.json({
      success: true,
      url: url
    });
  } catch (error) {
    console.error("[Upload Image API Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image" },
      { status: 500 }
    );
  }
}
