import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import axios from "axios";

// Environment variables
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN!;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --------------------
// GET: Facebook webhook verification
// --------------------
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// --------------------
// POST: Webhook events
// --------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entries = body.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        if (change.field !== "feed") continue;

        const data = change.value;
        if (!data.comment_id) continue;

        // Skip replies from page itself
        if (data.from?.id === entry.id) continue;

        const commentId: string = data.comment_id;
        const commentText: string = data.message ?? "";

        // Generate AI reply
        let reply = "Thank you for your comment!";

        try {
          const aiResponse = await openai.responses.create({
            model: "gpt-5.5",
            input: `
You are a helpful Facebook page assistant.

Reply to this Facebook comment naturally.
Keep the reply under 50 words.

Comment:
${commentText}
`,
          });

          reply = aiResponse.output_text?.trim() ?? reply;
        } catch (err) {
          console.error("OpenAI error:", err);
          // Fallback reply if quota exceeded or API error
          reply = "Thanks for your comment! We'll get back to you soon.";
        }

        // Reply to Facebook comment
        await axios.post(
          `https://graph.facebook.com/v25.0/${commentId}/comments`,
          {
            message: reply,
            access_token: PAGE_ACCESS_TOKEN,
          }
        );

        console.log("Replied to comment:", commentId, "Reply:", reply);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook POST error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}