import {llm} from "../llm"
import { HumanMessage } from "@langchain/core/messages"
import type { AnalyzeResult } from "./analyze"


export type Platform = "linkedIn" | "twitter" | "instagram" | "facebook"

export interface PlatformPost {
  platform: Platform;
  posts: GeneratedPost[];
}

export interface GeneratedPost {
  variant: number;         // 1 | 2 | 3 — multiple angles per platform
  hook: string;            // opening line designed to stop the scroll
  body: string;            // main copy
  cta: string;             // call-to-action line
  hashtags: string[];
  characterCount: number;
}

export interface GenerateResult {
  brandName: string;
  platforms: PlatformPost[];
  generatedAt: string;
}


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

// Core Generator

export async function generateContent(
    analysis:AnalyzeResult,
    platforms: Platform[] =["linkedIn", "twitter", "instagram", "facebook"]
):Promise<GenerateResult>{

    const results = await Promise.all(
         platforms.map((platform) => generateForPlatform(analysis, platform))
    );

    return {
        brandName: analysis.brandName,
    platforms: results,
    generatedAt: new Date().toISOString(),
    }

}


async function generateForPlatform( analysis: AnalyzeResult,
  platform: Platform):Promise<PlatformPost>{
    const rules = PLATFORM_RULES[platform];
    const prompt = buildPrompt(analysis, platform, rules);


    const response = await llm.invoke([new HumanMessage(prompt)]);

    const raw =
    typeof response.content === "string"
      ? response.content
      : response.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

          const posts = parsePosts(raw, platform);

       return { platform, posts };

}

function buildPrompt (analysis:AnalyzeResult, platform:Platform, rules:(typeof PLATFORM_RULES)[Platform]):string{
return `
You are an expert social media copywriter specializing in ${platform} content.

## Brand Intelligence
Brand: ${analysis.brandName}
Industry: ${analysis.industry}
Target Audience: ${analysis.targetAudience}
Tone of Voice: ${analysis.toneOfVoice}
Product/Service: ${analysis.productOrServiceSummary}

Unique Selling Points:
${analysis.uniqueSellingPoints.map((u) => `- ${u}`).join("\n")}

Pain Points Addressed:
${analysis.painPointsAddressed.map((p) => `- ${p}`).join("\n")}

Marketing Angles:
${analysis.marketingAngles.map((a) => `- ${a}`).join("\n")}

Suggested Taglines:
${analysis.suggestedTaglines.map((t) => `- ${t}`).join("\n")}

Key Features:
${analysis.keyFeatures.map((f) => `- ${f}`).join("\n")}

Call-to-Actions available:
${analysis.callToActions.map((c) => `- ${c}`).join("\n")}

## Platform Rules — ${platform.toUpperCase()}
Style: ${rules.style}
Max characters (hook + body + cta combined): ${rules.maxChars}
Max hashtags: ${rules.hashtagLimit}

## Task
Write 3 distinct post variants for ${platform}. Each must use a DIFFERENT marketing angle from the list above.

Respond ONLY with a valid JSON array — no markdown, no backticks, no explanation:

[
  {
    "variant": 1,
    "hook": "string — opening line, designed to stop the scroll",
    "body": "string — main copy body",
    "cta": "string — closing call-to-action line",
    "hashtags": ["string"]
  },
  {
    "variant": 2,
    "hook": "...",
    "body": "...",
    "cta": "...",
    "hashtags": ["string"]
  },
  {
    "variant": 3,
    "hook": "...",
    "body": "...",
    "cta": "...",
    "hashtags": ["string"]
  }
]
  `.trim();
}

function parsePosts(raw: string, platform: Platform): GeneratedPost[] {
  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed: Omit<GeneratedPost, "characterCount">[];

  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Failed to parse LLM response for ${platform}:\n${raw}`);
  }

  const rules = PLATFORM_RULES[platform];

  return parsed.map((post) => {
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
}