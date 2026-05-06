import type {Request, Response} from "express"
import { classifyIntent } from "../nodes/intent"
import { refinePlatformContent } from "../nodes/refine"
import { runAgent } from "../Workflow/workflow"
import type { Platform } from "../nodes/posts"
import {
  saveRevision,
  getLatestPlatformContent,
  getJobAnalysis,
  appendChatMessages,
  getMostRecentJobInConversation,
  saveJobToHistory,
} from "../service/history.service";
import { eq } from "drizzle-orm";
import { db, conversations } from "../models";

const VALID_PLATFORMS: Platform[] = ["linkedIn", "twitter", "instagram", "facebook"];

export async function chatController(req: Request, res: Response){

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if(!tavilyApiKey){
      res.status(500).json({success:false,error:"TAVILY_API_KEY not configured"})
      return;
    }
 
    const {conversationId, message, platforms} = req.body as {
      conversationId: string;
    message: string;
    platforms?: Platform[];
    }

    if(!conversationId || typeof conversationId!=="string"){
      res.status(400).json({ success: false, error: "`conversationId` is required" });
    return;
    }
    
     if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ success: false, error: "`message` is required" });
    return;
  }

  const userId:string |undefined = (req as any).user?.id;
  const activePlatforms:Platform[] = platforms ?? VALID_PLATFORMS;

   console.log(`\n${"─".repeat(60)}`);
  console.log(`[chat] conversationId=${conversationId} message="${message}"`);

    // Step -1:classify Intent

    let intent;
    try {
      intent = await classifyIntent(message, activePlatforms);
    } catch (error) {
      res.status(422).json({
          success: false,
      error: `Could not understand your request: ${error instanceof Error ? error.message : String(error)}`,
      })
      return;
    }

    console.log(`[chat] intent=${intent.type}`, intent);


    // Step 2 Refine latent

    if(intent.type ==="refine"){
      const jobId = await getMostRecentJobInConversation(conversationId)
      if(!jobId){
        res.status(404).json({ success: false, error: "No job found in this conversation to refine" });
      return;
      }
    


    //Load analysis 
    const [analysis, previousPlatformPost] = await Promise.all([
      getJobAnalysis(jobId),
      getLatestPlatformContent(jobId, intent.platform)
    ])

    if(!analysis){
       res.status(404).json({ success: false, error: "Could not find brand analysis for this job" });
      return;
    }

    if(!previousPlatformPost){
       res.status(404).json({
        success: false,
        error: `No existing content found for platform: ${intent.platform}`,
      });
      return;
    }

    let refinePost;
    try {
      refinePost = await refinePlatformContent({
        analysis,
        platform:intent.platform,
        instruction:intent.instruction,
        previousPosts:previousPlatformPost
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: `Refinement failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      return;
    }

   // Same revision + messages
   
   const {revision, version} = await saveRevision({
    jobId, 
    platform: intent.platform,
      platformPost: refinedPost,
      instruction: intent.instruction,
   })


   await appendChatMessages({
      conversationId,
      userMessage: message,
      assistantMessage: `Refined ${intent.platform} content (v${version}): applied "${intent.instruction}"`,
      metadata: { jobId, revisionId, platform: intent.platform, version },
   })

       console.log(`[chat] Refined ${intent.platform} → v${version} revisionId=${revisionId}`);

       res.status(200).json({
        success: true,
      type: "refine",
      platform: intent.platform,
      version,
      revisionId,
      posts: refinedPost.posts,
       });
       return;
  }
}