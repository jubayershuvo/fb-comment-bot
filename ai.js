import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiResponse = await openai.responses.create({
  model: "gpt-5.5",
  instructions: "You are a coding assistant that talks like a pirate",
  input: "Are semicolons optional in JavaScript?",
});


console.log(aiResponse.output_text);