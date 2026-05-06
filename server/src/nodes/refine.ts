// src/nodes/refine.ts
import { llm } from "../llm";
import { HumanMessage } from "@langchain/core/messages";
import type { AnalyzeResult } from "./analyze";
import type { Platform, PlatformPost, GeneratedPost } from "./posts";

// Re-export the platform rules so we don't duplicate them
const PLATFORM_RULES: Record<Platform, { maxChars: number; hashtagLimit: number; style: string }> = {
  linkedIn: {
    maxChars: 3000,
    hashtagLimit: 5,
    style: "Professional, insight-driven, story-led. Use line breaks generously. Ideal for thought leadership and B2B audiences.",
  },
  twitter: {
    maxChars: 280,
    hashtagLimit: 2,
    style: "Punchy, concise, witty. Hook in the first 8 words. One idea per tweet. No fluff.",
  },
  instagram: {
    maxChars: 2200,
    hashtagLimit: 15,
    style: "Conversational, aspirational, emoji-friendly. Lead with a bold hook. End with a question or CTA to drive comments.",
  },
  facebook: {
    maxChars: 500,
    hashtagLimit: 3,
    style: "Warm, community-focused, relatable. Tell a short story or pose a question. Drives shares and discussion.",
  },
};

export interface RefineInput {
  analysis: AnalyzeResult;
  platform: Platform;
  instruction: string;         // "make it more casual", "add emojis", etc.
  previousPosts: GeneratedPost[]; // the posts being refined
}

export async function refinePlatformContent(input: RefineInput): Promise<PlatformPost> {
  const { analysis, platform, instruction, previousPosts } = input;
  const rules = PLATFORM_RULES[platform];

  const previousSummary = previousPosts
    .map((p) => `Variant ${p.variant}:\nHook: ${p.hook}\nBody: ${p.body}\nCTA: ${p.cta}`)
    .join("\n\n---\n\n");

  const prompt = `
You are an expert social media copywriter specialising in ${platform} content.

## Brand Intelligence
Brand: ${analysis.brandName}
Industry: ${analysis.industry}
Target Audience: ${analysis.targetAudience}
Tone of Voice: ${analysis.toneOfVoice}
Product/Service: ${analysis.productOrServiceSummary}

## Platform Rules — ${platform.toUpperCase()}
Style: ${rules.style}
Max characters: ${rules.maxChars}
Max hashtags: ${rules.hashtagLimit}

## Previous Posts (to be refined)
${previousSummary}

## User Refinement Instruction
"${instruction}"

## Task
Rewrite all 3 variants applying the instruction above. Keep the same marketing angles but adjust tone/style/format as requested.

Respond ONLY with a valid JSON array — no markdown, no backticks, no explanation:

[
  {
    "variant": 1,
    "hook": "string",
    "body": "string",
    "cta": "string",
    "hashtags": ["string"]
  },
  { "variant": 2, "hook": "...", "body": "...", "cta": "...", "hashtags": ["string"] },
  { "variant": 3, "hook": "...", "body": "...", "cta": "...", "hashtags": ["string"] }
]
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

  let parsed: Omit<GeneratedPost, "characterCount">[];
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Failed to parse refined content for ${platform}:\n${raw}`);
  }

  const posts: GeneratedPost[] = parsed.map((post) => {
    const full = `${post.hook} ${post.body} ${post.cta}`;
    const hashtags = (post.hashtags ?? []).slice(0, rules.hashtagLimit);
    return {
      variant: post.variant,
      hook: post.hook ?? "",
      body: post.body ?? "",
      cta: post.cta ?? "",
      hashtags,
      characterCount: full.length,
    };
  });

  return { platform, posts };
}