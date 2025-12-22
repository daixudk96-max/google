import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChunkAnalysisResult, Segment } from "../types";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const splitTextIntoChunks = (text: string, chunkSize: number = 2400): string[] => {
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

export const analyzeChunk = async (
  chunkText: string, 
  chunkIndex: number, 
  systemPrompt: string,
  thinkingBudget: number = 0,
  previousContextSummary?: string
): Promise<ChunkAnalysisResult> => {
  const ai = getAiClient();
  // Using gemini-3-flash-preview as per guidelines for complex tasks (or when thinking is needed)
  // Although 3-pro is better for reasoning, flash is faster for bulk processing.
  // If thinkingBudget > 0, we can use 3-flash-preview which supports it.
  const modelId = "gemini-3-flash-preview"; 

  let prompt = `请深度重构以下文本片段 (第 ${chunkIndex + 1} 部分)。\n`;
  prompt += `**核心要求**：严格遵循 System Instruction 中的定义，将内容重写为**思维导图节点（短语）**。\n`;
  
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

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: config,
    });

    const responseText = response.text || "{}";
    const data = JSON.parse(responseText);

    return {
      chunkIndex,
      segments: data.segments || [],
      raw_text: chunkText
    };

  } catch (error) {
    console.error(`Error analyzing chunk ${chunkIndex}:`, error);
    return {
      chunkIndex,
      segments: [{
        id: `error-${chunkIndex}`,
        main_title: `分析失败 (Chunk ${chunkIndex + 1})`,
        segmentation_reason: "API Error",
        sub_segments: [{
          title: "Error",
          overview: "无法处理",
          content_nodes: [{ heading: "Error", text: "- 错误：此部分处理失败\n- 建议：重试或检查 API Key 或降低思考预算" }],
          key_points: []
        }]
      }]
    };
  }
};

// Helper to normalize strings for comparison (removes punctuation, spaces, case)
// Example: "源头商家，逻辑" -> "源头商家逻辑"
const normalizeTitle = (str: string) => {
  return str.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
};

// Fuzzy match logic for titles
const areTitlesSimilar = (t1: string, t2: string) => {
  if (!t1 || !t2) return false;
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  
  // 1. Exact match after normalization
  if (n1 === n2) return true;
  
  // 2. Containment (e.g., "Source Logic" vs "Source Logic Continued")
  // Only if length is substantial to avoid false positives on short words
  if (n1.length > 4 && n2.includes(n1)) return true;
  if (n2.length > 4 && n1.includes(n2)) return true;
  
  return false;
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
    const firstSegmentOfNext = nextChunkSegments[0];

    // Merge Logic: Use FUZZY MATCH instead of strict equality
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
    finalSegments = [...finalSegments, ...nextChunkSegments];
  }
  
  return finalSegments;
};
