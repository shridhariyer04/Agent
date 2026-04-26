import type { Request, Response } from "express";
import { runAgent } from "../Workflow/workflow";
import type { Platform } from "../nodes/posts";

const VALID_PLATFORMS: Platform[] = ["linkedIn", "twitter", "instagram", "facebook"];



function validatePlatforms(platforms:unknown):Platform[]{
       if (!platforms) return VALID_PLATFORMS;

        if (!Array.isArray(platforms)) {
    throw new Error("`platforms` must be an array");
  }


  const invalid = platforms.filter((p) =>!VALID_PLATFORMS.includes(p));
  if(invalid.length){
        throw new Error(`Invalid platforms: ${invalid.join(", ")}. Valid options: ${VALID_PLATFORMS.join(", ")}`);
  }

  return platforms as Platform[];
}

function validateUrl(url:unknown){
    if(!url || typeof url !== "string" || !url.trim()){
          throw new Error("`url` is required and must be a non-empty string");
    }
    return url.trim();
}


export async function runAgentController(req:Request, res:Response):Promise<void>{


    const tavilyApiKey = process.env.TAVILY_API_KEY;

     // ── Guard: API key must be configured server-side ──────────────────────────
  if (!tavilyApiKey) {
    res.status(500).json({
      success: false,
      error: "TAVILY_API_KEY is not configured on the server",
    });
    return;
  }

  // Input Validatoms

  let url:string;
  let platforms:Platform[];

  try {
     url = validateUrl(req.body.url);
    platforms = validatePlatforms(req.body.platforms);
  } catch (err) {
      res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Invalid request body",
    });
    return;
  }

   console.log(`\n${"─".repeat(60)}`);
  console.log(`[controller] New request → url=${url} platforms=${platforms.join(",")}`);


  const result = await runAgent({url, tavilyApiKey, platforms});

  console.log(
        `[controller] ${result.success ? "✓ Success" : "✗ Failed"} in ${result.durationMs}ms`
  )

    // ── Response ───────────────────────────────────────────────────────────────
  if (!result.success) {
    res.status(502).json({
      success: false,
      error: result.error,
      failedNode: result.failedNode,
      durationMs: result.durationMs,
    });
    return;
  }

  res.status(200).json({
    success: true,
    durationMs: result.durationMs,
    brand: {
      name: result.brandName,
      url,
    },
    analysis: result.analyzeResult,
    content: result.generateResult?.platforms,
  });

}