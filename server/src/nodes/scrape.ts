export interface ScrapedImage{
src:string;
alt?:string;
}


export interface ScrapeResult{
    url:string;
    brandName:string;
    title:string;
    description:string;
    rawContent:string;
    images:ScrapedImage[];
    keywords:string[];
    scrapedAt:string;
}

interface TavilyExtractResponse {
    results:{
        url:string;
        raw_content:string;
        images?:string[];
        metadata?:{
            title?:string;
            description?:string;
            keywords?:string;
            og_image?:string;
        }
    }[];
    failed_results?:{url:string; error:string}[];
}



// ---------------- Core Scraper -------------------------------------------------------


export async function scrapeWebsite(inputUrl:string,
    apiKey:string
):Promise<ScrapeResult> {

    const url = inputUrl.startsWith("http")? inputUrl:  `http://${inputUrl}`
    const response = await fetch("http://api.tavily.com/extract",{
        method:"POST",
        headers:{
            "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
        },
        body:JSON.stringify({
            urls:[url],
            include_images:true,
            extract_depth:"advanced", //"basic" |"advanced"
        })
    });

    if(!response.ok){
         const error = await response.text();
    throw new Error(`Tavily API error ${response.status}: ${error}`);
    }

    const data:TavilyExtractResponse = await response.json();

    if(data.failed_results?.length){
        throw new Error(
      `Tavily failed to scrape ${url}: ${data.failed_results[0].error}`
    );
    }

    const results = data.results[0];
    if(!results) throw new Error("No results returned from Tavily");

    const meta = results.metadata ?? {};
 
  // ── Brand name from hostname ───────────────────────────────────────────────
  const brandName =
    new URL(results.url).hostname.replace(/^www\./, "").split(".")[0];
 
  // ── Keywords from meta or extracted from content ───────────────────────────
  const keywords = meta.keywords
    ? meta.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : extractKeywordsFromContent(results.raw_content);
 
  // ── Images ────────────────────────────────────────────────────────────────
  const images: ScrapedImage[] = (results.images ?? [])
    .filter((src) => src.startsWith("http"))
    .map((src) => ({ src }));
 
  // Include OG image if present
  if (meta.og_image && !images.find((i) => i.src === meta.og_image)) {
    images.unshift({ src: meta.og_image, alt: "Featured image" });
  }
 
  return {
    url: results.url,
    brandName,
    title: meta.title ?? brandName,
    description: meta.description ?? extractFirstSentence(results.raw_content),
    rawContent: results.raw_content,
    images,
    keywords,
    scrapedAt: new Date().toISOString(),
  };
}
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function extractFirstSentence(text: string): string {
  const sentence = text.replace(/\s+/g, " ").trim().split(/[.!?]/)[0];
  return sentence?.trim() ?? "";
}
 
function extractKeywordsFromContent(content: string, limit = 10): string[] {
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
    "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
    "its", "may", "new", "now", "old", "see", "two", "who", "boy", "did",
    "this", "that", "with", "have", "from", "they", "will", "been", "more",
    "when", "your", "what", "said", "each", "she", "use", "into", "than",
    "then", "them", "these", "some", "her", "would", "make", "like", "time",
    "just", "know", "take", "into", "year", "good", "much", "also",
  ]);
 
  const words = content
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopWords.has(w));
 
  const freq: Record<string, number> = {};
  for (const word of words) freq[word] = (freq[word] ?? 0) + 1;
 
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);

}

