import {eq, desc, and,max} from "drizzle-orm"
import { db, conversations, jobs, generatedContent, messages, revisions } from "../models ";
import type { RunOutput } from "../Workflow/workflow";
import type { Platform, PlatformPost} from "../nodes/posts"
import { AnalyzeResult } from "../nodes/analyze";



export interface SaveJobInput {
    userId?:string;
    url:string;
    result:RunOutput;
    platforms:Platform[];
}


export interface JobSummary {
    jobId: string;
  conversationId: string;
  title: string;
  url: string;
  brandName: string | null;
  status: string;
  processingTimeMs: number | null;
  createdAt: Date | null;
}

export interface JobDetail {
     job: typeof jobs.$inferSelect;
  content: Array<{ platform: string; posts: PlatformPost["posts"] }>;
  messages: typeof messages.$inferSelect[];
}


// Write  


/**
 * 
 *Persiste one full agent run:
 1.Upserts a conversation (one per URL + user combo, reuses exiting)
 2. Creates a job record with full RunOutput snapshot
 3.Saves per-platform generated content roes
 4.Append user + assistant messages tp the conversation
 */


 export async function saveJobToHistory(input:SaveJobInput){

    const {userId, url, result, platforms} = input;


   const title = result.brandName
    ? `${result.brandName} — ${new URL(url.startsWith("http") ? url : `https://${url}`).hostname}`:url


    let conversationId:string;

    const existing = userId ?await db
    .select({id:conversations.id})
    .from(conversations)
    .where(and(eq(conversations.userId,userId), eq(conversations.title,title)))
    .limit(1):[]; 

    if(existing.length >0){
        conversationId = existing[0].id;
        // bump updatedAt
        await db
        .update(conversations)
        .set({updatedAt:new Date()})
        .where(eq(conversations.id, conversationId))
    } 
    else{
        const [convo] = await db
        .insert(conversations)
        .values({userId:userId ?? null, title})
        .returning({id:conversations.id});
        conversationId = convo.id;
    }

      // Create a job
      const status = result.success ?"completed":"failed";


      const [job] = await db
      .insert(jobs)
      .values({
        userid:userId ?? null,
        conversationId,
        url,
        status,
        extractedContent:result as unknown as Record<string,unknown>,
        processingTimeMs: result.durationMs,
      errorMessage: result.error ?? null,
      })
        .returning({ id: jobs.id });

        const jobId = job.id;

        // Save Generated cpmtent

        if(result.success && result.generateResult){
          const rows = result.generateResult.platforms.map((p)=>({
            jobId,
            platform:p.platform,
            content:JSON.stringify(p)
          }))

          if(rows.length >0){
             await db.insert(generatedContent).values(rows);
          }
        }

        // 4 Append message
         const assistantSummary = result.success
    ? `Generated content for ${result.brandName ?? url} across ${platforms.join(", ")}.`
    : `Failed to process ${url}: ${result.error}`;


    await db.insert(messages).values([
      {
      conversationId,
      role: "user",
      content: `Analyse and generate social content for: ${url}`,
      metadata: { platforms },
    },
    {
      conversationId,
      role: "assistant",
      content: assistantSummary,
      metadata: { jobId, status, durationMs: result.durationMs },
    },
    ])
    return {jobId, conversationId}; 

 }


 export async function listJobsForUser(userId:string):Promise<JobSummary[]>{
  const rows = await db 
  .select({
        jobId:jobs.id,
        conversationId:jobs.conversationId,
        title:conversations.title,
        url:jobs.url,
        status:jobs.status,
        processingTimeMs:jobs.processingTimeMs,
        createdAt:jobs.createdAt,
        extractedContent:jobs.extractedContent,
  })
  .from(jobs)
  .leftJoin(conversations, eq(jobs.conversationId, conversations.id))
  .where(userId ? eq(jobs.userId, userId) : undefined)
  .orderBy(desc(jobs.createdAt))
  .limit(100);

  return rows.map((r:any)=>({
    jobId:r.jobId,
    conversationId:r.conversationId ?? "",
     title:           r.title ?? r.url,
    url:             r.url,
    brandName:       (r.extractedContent as any)?.brandName ?? null,
    status:          r.status ?? "unknown",
    processingTimeMs: r.processingTimeMs,
    createdAt:       r.createdAt,
  }))
 }

 export async function getJobDetail(jobId:string):Promise<JobDetail | null>{

  const [jobRow] = await db
  .select()
  .from(jobs)
  .where(eq(jobs.id,jobId))
  .limit(1);

    if (!jobRow) return null;


    
    const contentRows = await db
    .select()
    .from(generatedContent)
    .where(eq(generatedContent.jobId,jobId));


    const msgRows = jobRow.conversationId
    ? await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, jobRow.conversationId))
    .orderBy(messages.createdAt):[]

    const content = contentRows.map((r:any)=>{
      const parsed:PlatformPost =JSON.parse(r.content);
        return { platform: r.platform, posts: parsed.posts };
    })
    return {job:jobRow, content, messages:msgRows}
 }


 export async function getConversationJobs(conversationId:string) {
  return db.select()
  .from(jobs)
  .where(eq(jobs.conversationId, conversationId))
    .orderBy(jobs.createdAt);
 }

 // Revision write

 /**
  * Saves a rnew revision row. Auto incremenrt per job+platform
  *  Also mirrors into generated_content so the latest is always queryable
 * from the original table without joining revisions.
  */

 export async function saveRevision(input:{jobId: string;
  platform: Platform;
  platformPost: PlatformPost;
  instruction: string;}):Promise<{ revisionId: string; version: number }> {


    const {jobId, platform, platformPost, instruction} = input;

    // Gte current max version
      const [maxRow] = await db
    .select({ maxVersion: max(revisions.version) })
    .from(revisions)
    .where(and(eq(revisions.jobId, jobId), eq(revisions.platform, platform)));


    const nextVersion = (maxRow?.maxVersion??0)+1;

    const [rev] = await db
    .insert(revisions)
    .values({
       jobId,
      platform,
      version: nextVersion,
      content: JSON.stringify(platformPost),
      instruction,
    })   .returning({ id: revisions.id });

       
     // Update generated_content so GET /hiostory/jobs:id always return latest

     const existing = await db
     .select({ id: generatedContent.id })
     .from(generatedContent)
     .where(and(eq(generatedContent.jobId, jobId),eq(generatedContent.platform, platform)))
     .limit(1)


     if(existing.length >0){
      await db
      .update(generatedContent)
      .set({ content: JSON.stringify(platformPost)})
      .where(eq(generatedContent.id, existing[0].id))
     }  
      return { revisionId: rev.id, version: nextVersion };
 }
   
    export async function getRevisionHistory(jobId: string, platform: Platform) {
      return db
      .select()
      .from(revisions)
      .where(and(eq(revisions.jobId, jobId), eq(revisions.platform, platform)))
      .orderBy(revisions.version)
    }



    export async function getLatestPlatformContent(jobId:string,platform:Platform):Promise<PlatformPost |null>{
      const [row] = await db
      .select()
      .from(generatedContent)
      .where(and(eq(generatedContent.jobId,jobId),eq(generatedContent.platform,platform)))
      .limit(1)

      if(!row) return null;
      return JSON.parse(row.content) as PlatformPost;
    }


    /*
    Get the stored AnalyzeResult for a job
    */

    export async function getJobAnalysis(jobId:string):Promise<AnalyzeResult | null>{

      const [row] = await db
      .select({extractedContent:jobs.extractedContent})
      .from(jobs)
      .where(eq(jobs.id,jobId))
      .limit(1)

      if(!row?.extractedContent) return null;
      const data = row.extractedContent as any;
      return data?.AnalyzeResult ?? null;

    }


    /* Append a user + assistant message  */

    export async function appendChatMessages(input:{
      conversationId: string;
  userMessage: string;
  assistantMessage: string;
  metadata?: Record<string, unknown>;
    }){

       const {conversationId, userMessage, assistantMessage, metadata} = input;

       await db
       .insert(messages)
       .values([ {
      conversationId,
      role: "user",
      content: userMessage,
      metadata: metadata ?? null,
    },
    {
       conversationId,
      role: "assistant",
      content: assistantMessage,
      metadata: metadata ?? null,
    }
  ]);

  // bump conversation updatedAt
  await
  db
  .update(conversations)
  .set({updatedAt:new Date()})
  .where(eq(conversations.id, conversationId));


    }


    export async function getMostRecentJobInConversation(conversationId:string):Promise<string|null>{
      const [row] = await db
      .select({id:jobs.id})
      .from(jobs)
       .where(eq(jobs.conversationId, conversationId))
       .orderBy(desc(jobs.createdAt))
       .limit(1);

       return row?.id ?? null;

    }