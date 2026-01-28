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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const phone = formData.get("phone") as string;
    const displayName = formData.get("displayName") as string;
    const senderName = (formData.get("senderName") as string) || "Khả Nhi Vucar";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    // 1. Upload images to S3
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.from(await file.arrayBuffer());

      // Sanitizing displayName for filename
      const safeDisplayName = (displayName || "unknown").trim().replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `InspectionImage/${phone}-${safeDisplayName}-${i + 1}.jpg`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: file.type || "image/jpeg",
        })
      );

      const url = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/${fileName}`;
      uploadedUrls.push(url);
    }

    // 2. Send image links to webhook one by one
    for (const url of uploadedUrls) {
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
    }

    // 3. Send customer phone to webhook
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            from: { display_name: senderName },
            text: phone,
          },
        }),
      });
    } catch (webhookError) {
      console.error("[Webhook Error] Failed to send customer phone:", phone, webhookError);
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      count: uploadedUrls.length
    });
  } catch (error) {
    console.error("[Upload Image API Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload images" },
      { status: 500 }
    );
  }
}
