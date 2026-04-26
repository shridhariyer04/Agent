import {StateGraph, END, START} from "@langchain/langgraph"
import { Annotation } from "@langchain/langgraph"

import { scrapeWebsite, type ScrapeResult } from "../nodes/scrape";
import { analyzeWebsite, type AnalyzeResult } from "../nodes/analyze";
import { generateContent, type GenerateResult, type Platform } from "../nodes/posts";



const AgentState = Annotation.Root({
    // -Inputs --------------
    url:Annotation<string>(),
    tavilyApiKey:Annotation<string>(),
    platforms: Annotation<Platform[]>(),

    // Nde outputs

    scrapeResult:Annotation<ScrapeResult | null>({
          reducer: (_, next) => next,
           default: () => null,
    }),

    analyzeResult:Annotation<AnalyzeResult | null>({
        reducer:(_,next) =>next,
        default:() =>null,
    }),
    generateResult: Annotation<GenerateResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

   error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  failedNode:Annotation<"scrape" |"analyze" | "generate" |null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Meta
  startedAt:Annotation<string>(),
  completedAt:Annotation<string | null>({
     reducer: (_, next) => next,
    default: () => null,
  }),
})


type AgentStateType = typeof AgentState.State;

async function scrapeNode(
    state:AgentStateType
):Promise<Partial<AgentStateType>>{
     console.log(`[scrape] Fetching → ${state.url}`);
     try {
        const scrapeResult = await scrapeWebsite(state.url, state.tavilyApiKey);
        console.log(`[scrape] ✓ ${scrapeResult.images.length} images, ${scrapeResult.keywords.length} keywords`);
    return { scrapeResult };
     } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[scrape] ✗ ${error}`);
    return { error, failedNode: "scrape" };
  }
}

 async function analyzeNode(
    state:AgentStateType
 ):Promise<Partial<AgentStateType>>{
    console.log(`[analyze] Building marketing intelligence for ${state.scrapeResult!.brandName}`);
  try {
    const analyzeResult = await analyzeWebsite(state.scrapeResult!);
    console.log(`[analyze] ✓ Industry: ${analyzeResult.industry} | USPs: ${analyzeResult.uniqueSellingPoints.length}`);
    return { analyzeResult };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[analyze] ✗ ${error}`);
    return { error, failedNode: "analyze" };
  }
 }


 async function generateNode(
    state:AgentStateType
 ):Promise<Partial<AgentStateType>>{
      console.log(`[generate] Writing content for: ${state.platforms.join(", ")}`);
    try {
        const generateResult = await generateContent(
             state.analyzeResult!,
             state.platforms
        );
        const totalPosts = generateResult.platforms.reduce(
            (sum, p) =>sum +p.posts.length,0
        );
        return{
              generateResult,
      completedAt: new Date().toISOString(),
        }
        console.log(`[generate] ✓ ${totalPosts} posts across ${generateResult.platforms.length} platforms`);
    } catch (err) {
         const error = err instanceof Error ? err.message : String(err);
    console.error(`[generate] ✗ ${error}`);
    return { error, failedNode: "generate" };
    }
 }




 // Conditional Edges
 function afterScrape(state: AgentStateType): "analyze" | "error" {
  return state.error ? "error" : "analyze";
}

function afterAnalyze(state: AgentStateType): "generate" | "error" {
  return state.error ? "error" : "generate";
}

function afterGenerate(state: AgentStateType): typeof END | "error" {
  return state.error ? "error" : END;
}


async function errorNode(state: AgentStateType) : Promise<Partial<AgentStateType>> {
     console.error(`\n[workflow] Pipeline failed at node="${state.failedNode}"`);
  console.error(`[workflow] Reason: ${state.error}`);
  return { completedAt: new Date().toISOString() };
}

// Graph Assembly

const workflow = new StateGraph(AgentState)
  .addNode("scrape", scrapeNode)
  .addNode("analyze", analyzeNode)
  .addNode("generate", generateNode)
.  addNode("handle_error", errorNode)

  .addEdge(START,"scrape")
  .addConditionalEdges("scrape", afterScrape, {
  analyze: "analyze",
  error: "handle_error"
})

 .addConditionalEdges("analyze", afterAnalyze, {
  generate: "generate",
  error: "handle_error"
})

 .addConditionalEdges("generate", afterGenerate, {
  [END]: END,
  error: "handle_error"
})

 .addEdge("handle_error", END);


  export const graph = workflow.compile();


  // Public Runner -------------


  export interface RunInput{
      url: string;
  tavilyApiKey: string;
  platforms?: Platform[];

  }

  export interface RunOutput {
  success: boolean;
  brandName?: string;
  scrapeResult?: ScrapeResult;
  analyzeResult?: AnalyzeResult;
  generateResult?: GenerateResult;
  error?: string;
  failedNode?: string;
  durationMs: number;
}


export async function runAgent(input:RunInput):Promise<RunOutput>{

 const startedAt = new Date().toISOString();
 const startMs = Date.now();


 const finalState = await graph.invoke({
    url: input.url,
    tavilyApiKey: input.tavilyApiKey,
    platforms: input.platforms ?? ["linkedIn", "twitter", "instagram", "facebook"],
    startedAt,

 })

 const durationMs = Date.now() - startMs;


 if (finalState.error) {
    return {
      success: false,
      error: finalState.error,
      failedNode: finalState.failedNode ?? undefined,
      durationMs,
    };
  }

  return {
    success: true,
    brandName: finalState.generateResult?.brandName,
    scrapeResult: finalState.scrapeResult!,
    analyzeResult: finalState.analyzeResult!,
    generateResult: finalState.generateResult!,
    durationMs,
  };

}