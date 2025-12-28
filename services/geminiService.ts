import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChunkAnalysisResult, Segment } from "../types";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Changed default chunk size to 3000
export const splitTextIntoChunks = (text: string, chunkSize: number = 3000): string[] => {
  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + chunkSize, text.length);
    if (endIndex < text.length) {
      const lastNewline = text.lastIndexOf('\n', endIndex);
      if (lastNewline > currentIndex + (chunkSize * 0.8)) {
        endIndex = lastNewline + 1; 
      }
    }
    const cleanText = text.slice(currentIndex, endIndex).replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "");
    chunks.push(cleanText);
    currentIndex = endIndex;
  }
  return chunks;
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates the "Effective Content Length" of the generated segments.
 * 
 * METHODOLOGY:
 * 1. Counts CHARACTERS (UTF-16 units), NOT Tokens.
 * 2. Counts only the VALUES inside the JSON (titles, headings, text).
 * 3. Does NOT count JSON syntax (braces, quotes, keys).
 * 4. Trims whitespace to prevent "padding" with spaces.
 */
const calculateTotalContentLength = (segments: Segment[]): number => {
  let total = 0;
  if (!Array.isArray(segments)) return 0;
  
  for (const seg of segments) {
    total += (seg.main_title?.trim().length || 0);
    // segmentation_reason is meta-data, but it proves understanding, so we count it
    total += (seg.segmentation_reason?.trim().length || 0); 

    if (seg.sub_segments) {
      for (const sub of seg.sub_segments) {
         total += (sub.title?.trim().length || 0) + (sub.overview?.trim().length || 0);
         if (sub.content_nodes) {
            for (const node of sub.content_nodes) {
               total += (node.heading?.trim().length || 0);
               // The text body is the most important part
               total += (node.text?.trim().length || 0);
            }
         }
         if (sub.key_points) {
            // Count key points content
            total += sub.key_points.reduce((acc, curr) => acc + (curr?.trim().length || 0), 0);
         }
      }
    }
  }
  return total;
};

// Helper: Attempt to repair truncated JSON
const attemptJsonRepair = (jsonStr: string): any => {
  let trimmed = jsonStr.trim();
  if (!trimmed) return {};

  // 1. Check if we are inside a string
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  // 2. If ended inside string, close it
  if (inString) {
    trimmed += '"';
  }

  // 3. Close remaining open structures
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') trimmed += '}';
    else if (open === '[') trimmed += ']';
  }

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error("Failed to repair JSON:", e);
    // If repair fails, throw original or new error to be caught by caller
    throw new Error("JSON Repair Failed: " + (e instanceof Error ? e.message : String(e)));
  }
};

export const analyzeChunk = async (
  chunkText: string, 
  chunkIndex: number, 
  systemPrompt: string,
  thinkingBudget: number = 0,
  previousContextSummary?: string
): Promise<ChunkAnalysisResult> => {
  const ai = getAiClient();
  // Confirmed: Using gemini-3-pro-preview for high complexity tasks
  const modelId = "gemini-3-pro-preview"; 

  let prompt = `请深度重构以下文本片段 (第 ${chunkIndex + 1} 部分)。\n`;
  prompt += `**核心要求**：严格遵循 System Instruction 中的定义，将内容重写为**思维导图节点**。\n`;
  
  // Dynamic prompt based on input length
  const inputLength = chunkText.length;
  const expectedOutput = inputLength >= 2800 ? 2000 : Math.floor(inputLength * 0.6);
  
  prompt += `**字数目标 (Quality Gate)**：本片段输入长度为 ${inputLength} 字。要求你的**JSON有效内容输出字数至少达到 ${expectedOutput} 字**。请务必保留每一个细节，不要概括。\n`;
  prompt += `**结尾完整性检查**：在输出前，务必检查输入文本的最后一句。如果该句包含重要信息或时间戳，**必须**将其包含在最后一个节点中，严禁在中间截断。\n`;
  
  if (previousContextSummary) {
    prompt += `**重要 - 上下文连续性**：\n`;
    prompt += `上一部分的结尾主题是："${previousContextSummary}"。\n`;
    prompt += `如果本片段的开头依然在讨论该主题，**请务必使用完全相同的主标题 (Main Title)**，不要改写，以便系统能自动合并章节。\n`;
    prompt += `例如，如果上一章叫“源头生意逻辑”，这章继续讲这个，标题必须也是“源头生意逻辑”。\n\n`;
  }

  prompt += `**待分析文本**：\n${chunkText}`;

  // Configure Thinking Budget
  const config: any = {
    systemInstruction: systemPrompt,
    responseMimeType: "application/json",
    maxOutputTokens: 8192, // Explicitly set to high limit to reduce truncation risk
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              main_title: { type: Type.STRING },
              timestamp_start: { type: Type.STRING, nullable: true },
              timestamp_end: { type: Type.STRING, nullable: true },
              segmentation_reason: { type: Type.STRING },
              sub_segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    overview: { type: Type.STRING },
                    content_nodes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          heading: { type: Type.STRING },
                          text: { type: Type.STRING }
                        },
                        required: ["heading", "text"]
                      }
                    },
                    key_points: { 
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    original_snippet: { type: Type.STRING, nullable: true }
                  },
                  required: ["title", "overview", "content_nodes", "key_points"]
                }
              }
            },
            required: ["id", "main_title", "segmentation_reason", "sub_segments"]
          }
        }
      },
      required: ["segments"]
    }
  };

  // Add thinking config if budget is set
  if (thinkingBudget > 0) {
    config.thinkingConfig = { thinkingBudget: thinkingBudget };
  }

  let retries = 0;
  // Increased max retries to 10 to handle unstable network environments better
  const maxRetries = 10; 
  let baseDelay = 3000; 

  while (true) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: config,
      });

      const responseText = response.text || "{}";
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.warn(`Chunk ${chunkIndex} JSON parse failed (likely truncated). Attempting repair...`);
        try {
          data = attemptJsonRepair(responseText);
          console.log(`Chunk ${chunkIndex} JSON repaired successfully.`);
        } catch (repairError) {
          console.error(`Chunk ${chunkIndex} JSON repair failed.`);
          throw e; // Throw original error to trigger retry or fail state
        }
      }

      const segmentsRaw = data.segments || [];

      // --- QUALITY GATE: CONTENT LENGTH CHECK ---
      const generatedLength = calculateTotalContentLength(segmentsRaw);
      
      // Determine threshold based on strict user requirements
      // Rule: Input 3000 -> Output >= 2000. 
      // Rule: General -> Output >= 60% of input.
      let minThreshold = 0;
      
      if (inputLength >= 2800) {
        // Strict user requirement for full chunks
        minThreshold = 2000;
      } else if (inputLength > 800) {
        // Proportional requirement for partial chunks or smaller inputs
        minThreshold = Math.floor(inputLength * 0.6);
      }
      
      // If valid threshold exists and we failed it
      if (minThreshold > 0 && generatedLength < minThreshold) {
         throw new Error(`OUTPUT_TOO_SHORT: Input ${inputLength} chars -> Generated ${generatedLength} meaningful chars. (Required > ${minThreshold}). Triggering retry for more detail.`);
      }
      // ------------------------------------------

      // Pre-process IDs to ensure uniqueness across chunks to prevent React key issues
      const segments = segmentsRaw.map((seg: Segment, idx: number) => ({
        ...seg,
        id: seg.id || `chunk-${chunkIndex}-seg-${idx}-${Date.now()}`
      }));

      return {
        chunkIndex,
        segments: segments,
        raw_text: chunkText
      };

    } catch (error: any) {
      // Normalize error message for easier matching
      const errorMsg = (error.message || JSON.stringify(error)).toLowerCase();

      // 1. Rate Limits & Quotas
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("resource_exhausted") || errorMsg.includes("quota");
      
      // 2. Server Errors (Overloaded / Internal / 500s)
      // Including "500" specifically to catch "Rpc failed due to xhr error... error code: 6" which often manifests as 500 or XHR failures
      const isServerSideError = errorMsg.includes("503") || errorMsg.includes("500") || errorMsg.includes("overloaded") || errorMsg.includes("internal server error");
      
      // 3. Data Processing Errors
      const isJsonError = error instanceof SyntaxError || errorMsg.includes("json") || errorMsg.includes("syntax");
      const isOutputShort = errorMsg.includes("output_too_short");
      
      // 4. Network / Transport Errors (Critical fix for the screenshot)
      // "Rpc failed", "xhr error", "fetch failed", "network request failed"
      const isNetworkError = errorMsg.includes("rpc failed") || 
                             errorMsg.includes("xhr error") || 
                             errorMsg.includes("fetch failed") || 
                             errorMsg.includes("network error") ||
                             errorMsg.includes("failed to fetch") ||
                             errorMsg.includes("error code: 6"); // Chrome specific network error code

      const shouldRetry = (isRateLimit || isServerSideError || isJsonError || isOutputShort || isNetworkError);

      if (shouldRetry && retries < maxRetries) {
        retries++;
        
        let waitTime = 0;
        
        if (isOutputShort) {
           // Short output errors don't need long backoff, just a retry
           waitTime = 2000;
           console.warn(`⚠️ [Quality Gate Failed] Chunk ${chunkIndex}: ${errorMsg}. Retrying (Attempt ${retries}/${maxRetries})...`);
        } else {
           // Exponential backoff for network/server errors
           const jitter = Math.random() * 1000;
           waitTime = (baseDelay * Math.pow(1.5, retries - 1)) + jitter; 
           console.warn(`Chunk ${chunkIndex} hit retriable error: "${errorMsg}". Retrying in ${(waitTime/1000).toFixed(1)}s... (Attempt ${retries}/${maxRetries})`);
        }
        
        await delay(waitTime);
        continue;
      }

      console.error(`Error analyzing chunk ${chunkIndex} after ${retries} retries:`, error);
      
      // If we failed after all retries, return an error segment rather than crashing
      return {
        chunkIndex,
        segments: [{
          id: `error-${chunkIndex}`,
          main_title: `分析失败 (Chunk ${chunkIndex + 1})`,
          segmentation_reason: "Processing Error",
          sub_segments: [{
            title: "Data Processing Error",
            overview: "该片段数据处理失败，已达到最大重试次数。",
            content_nodes: [{ 
                heading: "Error Details", 
                text: `- 错误信息：${error.message}\n- 可能原因：网络连接不稳定、API服务暂时过载或内容过长。\n- 建议：请检查网络连接后重试，或稍后再次上传。` 
            }],
            key_points: []
          }]
        }]
      };
    }
  }
};

// Helper to normalize strings for comparison (removes punctuation, spaces, case)
// Example: "源头商家，逻辑" -> "源头商家逻辑"
const normalizeTitle = (str: string) => {
  return str.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
};

// Calculate Jaccard Similarity (Character Set Overlap)
// Returns 0 to 1
const calculateSimilarity = (s1: string, s2: string) => {
  if (!s1 || !s2) return 0;
  const n1 = normalizeTitle(s1);
  const n2 = normalizeTitle(s2);
  
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  const set1 = new Set(n1.split(''));
  const set2 = new Set(n2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
};

// Fuzzy match logic for titles
const areTitlesSimilar = (t1: string, t2: string) => {
  const score = calculateSimilarity(t1, t2);
  // Threshold 0.6 means about 60% of characters are shared
  return score > 0.6;
};

export const stitchResults = (results: ChunkAnalysisResult[]): Segment[] => {
  if (results.length === 0) return [];
  
  // Start with the first chunk's segments
  let finalSegments: Segment[] = JSON.parse(JSON.stringify(results[0].segments)); // Deep copy to avoid mutation

  for (let i = 1; i < results.length; i++) {
    const nextChunkSegments = JSON.parse(JSON.stringify(results[i].segments)); // Deep copy
    if (!nextChunkSegments || nextChunkSegments.length === 0) continue;

    // Check boundary: Last segment of Accumulated vs First segment of Next
    const lastSegment = finalSegments[finalSegments.length - 1];
    
    // We check the first segment of the new chunk
    // Sometimes the AI generates a small "summary" segment first, so we might need to check the second one too, 
    // but usually merging the first is sufficient if the prompt is followed.
    const firstSegmentOfNext = nextChunkSegments[0];

    if (lastSegment && firstSegmentOfNext && areTitlesSimilar(lastSegment.main_title, firstSegmentOfNext.main_title)) {
       console.log(`Merging segments (fuzzy match): "${lastSegment.main_title}" + "${firstSegmentOfNext.main_title}"`);
       
       // 1. Merge sub-segments
       lastSegment.sub_segments = [
         ...lastSegment.sub_segments,
         ...firstSegmentOfNext.sub_segments
       ];

       // 2. Update timestamp end
       lastSegment.timestamp_end = firstSegmentOfNext.timestamp_end;

       // 3. Remove the first segment from nextChunkSegments as it's now merged
       nextChunkSegments.shift();
    }

    // Append the remaining segments from the next chunk
    // Ensure we don't accidentally add another duplicate if the similarity check missed something obvious
    // but the ID happens to be identical (unlikely with timestamp IDs, but good practice)
    const uniqueNextSegments = nextChunkSegments.filter((ns: Segment) => 
      !finalSegments.some(fs => fs.id === ns.id)
    );

    finalSegments = [...finalSegments, ...uniqueNextSegments];
  }
  
  return finalSegments;
};