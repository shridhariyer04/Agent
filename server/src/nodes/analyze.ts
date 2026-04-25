import { llm } from "../llm";
import { HumanMessage } from "@langchain/core/messages";
import type { ScrapeResult } from "./scrape";


export interface AnalyzeResult {
  brandName: string;
  industry: string;
  targetAudience: string;
  toneOfVoice: string;
  uniqueSellingPoints: string[];
  productOrServiceSummary: string;
  competitors: string[];
  painPointsAddressed: string[];
  callToActions: string[];
  marketingAngles: string[];
  suggestedTaglines: string[];
  keyFeatures: string[];
  analyzedAt: string;
}

// Core Analyzer 

export async function analyzeWebsite(scraped:ScrapeResult):Promise<AnalyzeResult>{
    const prompt = buildPrompt(scraped)

    const response = await llm.invoke([new HumanMessage(prompt)]);

    const raw = typeof response.content ==="string"
    ? response.content
    :response.content
    .filter((b):b is {type:"text"; text:string} =>b.type === "text")
    .map((b) =>b.text)
    .join("");

    return parseAnalysis(raw,scraped);
}

// Prompt Builder 

function buildPrompt(scraped:ScrapeResult):string{
    const contentSnippet = scraped.rawContent.slice(0,6000);

    return `
    You are a senior marketing strategist. Analyze the following website content and extract structured marketing intelligence.
 
Website URL: ${scraped.url}
Brand Name: ${scraped.brandName}
Page Title: ${scraped.title}
Meta Description: ${scraped.description}
Keywords: ${scraped.keywords.join(", ")}
 
Page Content:
"""
${contentSnippet}
"""
 
Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation. Use this exact structure:
 
{
  "industry": "string — e.g. SaaS, E-commerce, Healthcare, Fintech",
  "targetAudience": "string — who this brand is targeting",
  "toneOfVoice": "string — e.g. Professional, Casual, Playful, Bold, Trustworthy",
  "uniqueSellingPoints": ["string", "..."],
  "productOrServiceSummary": "string — one clear paragraph about what they offer",
  "competitors": ["string — likely competitors based on industry"],
  "painPointsAddressed": ["string — customer problems this brand solves"],
  "callToActions": ["string — CTAs found or implied on the site"],
  "marketingAngles": ["string — angles that could work well for ads/copy"],
  "suggestedTaglines": ["string — 3-5 punchy tagline ideas for this brand"],
  "keyFeatures": ["string — core features or offerings"]
}
    `.trim();
}


// Response Parser
function parseAnalysis(raw:string,scraped:ScrapeResult):AnalyzeResult{

  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed:Omit<AnalyzeResult, "brandName" |"analyzedAt">

  try {
    parsed = JSON.parse(clean);
  } catch (error) {
        throw new Error(`Failed to parse LLM response as JSON:\n${raw}`);
  }

  return{
     brandName: scraped.brandName,
    industry: parsed.industry ?? "Unknown",
    targetAudience: parsed.targetAudience ?? "",
    toneOfVoice: parsed.toneOfVoice ?? "",
    uniqueSellingPoints: parsed.uniqueSellingPoints ?? [],
    productOrServiceSummary: parsed.productOrServiceSummary ?? "",
    competitors: parsed.competitors ?? [],
    painPointsAddressed: parsed.painPointsAddressed ?? [],
    callToActions: parsed.callToActions ?? [],
    marketingAngles: parsed.marketingAngles ?? [],
    suggestedTaglines: parsed.suggestedTaglines ?? [],
    keyFeatures: parsed.keyFeatures ?? [],
    analyzedAt: new Date().toISOString(),
  }

}