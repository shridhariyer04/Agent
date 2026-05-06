// src/nodes/intent.ts
import { llm } from "../llm";
import { HumanMessage } from "@langchain/core/messages";
import type { Platform } from "./posts";

export type IntentType = "refine" | "new_url";

export interface RefineIntent {
  type: "refine";
  platform: Platform;       // which platform to regenerate
  instruction: string;      // e.g. "make it more casual and add emojis"
}

export interface NewUrlIntent {
  type: "new_url";
  url: string;
}

export type Intent = RefineIntent | NewUrlIntent;

const VALID_PLATFORMS: Platform[] = ["linkedIn", "twitter", "instagram", "facebook"];

export async function classifyIntent(
  userMessage: string,
  availablePlatforms: Platform[]
): Promise<Intent> {
  const prompt = `
You are an intent classifier for a social media content generation tool.

The user has previously generated content for these platforms: ${availablePlatforms.join(", ")}.

Classify the following user message into exactly one of two intents:

1. "refine" — the user wants to modify/regenerate content for a specific platform
2. "new_url" — the user wants to analyse a new website URL

Respond ONLY with a valid JSON object, no markdown, no explanation:

For refine:
{"type":"refine","platform":"<one of: ${availablePlatforms.join("|")}>","instruction":"<what they want changed>"}

For new_url:
{"type":"new_url","url":"<the full URL they mentioned>"}

User message: "${userMessage.replace(/"/g, "'")}"
  `.trim();

  const response = await llm.invoke([new HumanMessage(prompt)]);

  const raw =
    typeof response.content === "string"
      ? response.content
      : response.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed: Intent;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Fallback: if we can't parse, treat as a refine with the raw message
    // This handles edge cases like "make all of them shorter"
    throw new Error(`Failed to classify intent: ${raw}`);
  }

  // Validate
  if (parsed.type === "refine") {
    if (!VALID_PLATFORMS.includes(parsed.platform)) {
      throw new Error(`Unknown platform in intent: ${parsed.platform}`);
    }
  }

  return parsed;
}