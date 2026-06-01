import express from "express";
import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// Webhook events
app.post("/webhook", async (req, res) => {
  try {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== "feed") continue;

        const data = change.value;

        if (!data.comment_id) continue;

        // Skip replies from page itself
        if (data.from?.id === entry.id) continue;

        const commentId = data.comment_id;
        const commentText = data.message || "";

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

        const reply =
          aiResponse.output_text?.trim() || "Thank you for your comment!";

        await axios.post(
          `https://graph.facebook.com/v25.0/${commentId}/comments`,
          {
            message: reply,
            access_token: PAGE_ACCESS_TOKEN,
          },
        );

        console.log("Replied:", reply);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
