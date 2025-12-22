import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChunkAnalysisResult, SEGMENT_MASTER_SYSTEM_PROMPT, MIND_MAP_SYSTEM_PROMPT, Segment, MindMapNode } from "../types";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const splitTextIntoChunks = (text: string, chunkSize: number = 10000): string[] => {
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
    chunks.push(text.slice(currentIndex, endIndex));
    currentIndex = endIndex;
  }
  return chunks;
};

export const analyzeChunk = async (
  chunkText: string, 
  chunkIndex: number, 
  previousContextSummary?: string
): Promise<ChunkAnalysisResult> => {
  const ai = getAiClient();
  const modelId = "gemini-3-flash-preview"; 

  let prompt = `请分析以下文本片段 (第 ${chunkIndex + 1} 部分)。\n`;
  prompt += `**任务强调**：请务必生成**极度详尽**的总结，作为自学教材使用。每个Chunk的输出如果不包含JSON结构字符，纯文本内容应尽量接近 3000 字左右或更多，保留所有细节。\n\n`;
  
  if (previousContextSummary) {
    prompt += `**上下文提示**：这是大文件的中间部分。上一部分的结尾讨论了："${previousContextSummary}"。请参考此上下文来判断当前部分的开头是否接续上一部分。\n\n`;
  }

  prompt += `**待分析文本**：\n${chunkText}`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SEGMENT_MASTER_SYSTEM_PROMPT,
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
                        summary: { type: Type.STRING },
                        key_points: { 
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        original_snippet: { type: Type.STRING, nullable: true }
                      },
                      required: ["title", "summary", "key_points"]
                    }
                  }
                },
                required: ["id", "main_title", "segmentation_reason", "sub_segments"]
              }
            }
          },
          required: ["segments"]
        }
      },
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
          summary: "此部分无法处理，请稍后重试或检查 API 配额。",
          key_points: []
        }]
      }]
    };
  }
};

export const stitchResults = (results: ChunkAnalysisResult[]): Segment[] => {
  if (results.length === 0) return [];
  let finalSegments: Segment[] = [...results[0].segments];

  for (let i = 1; i < results.length; i++) {
    const currentChunkSegments = results[i].segments;
    if (!currentChunkSegments || currentChunkSegments.length === 0) continue;
    finalSegments = [...finalSegments, ...currentChunkSegments];
  }
  return finalSegments;
};

export const generateMindMap = async (segments: Segment[]): Promise<MindMapNode | null> => {
  const ai = getAiClient();
  const modelId = "gemini-3-flash-preview";

  // Prepare a consolidated text of the detailed summaries to feed into the Mind Map generator
  let consolidatedContent = "";
  segments.forEach(seg => {
    consolidatedContent += `## ${seg.main_title}\n`;
    seg.sub_segments.forEach(sub => {
      consolidatedContent += `### ${sub.title}\n`;
      consolidatedContent += `内容摘要: ${sub.summary}\n`;
      consolidatedContent += `关键点: ${sub.key_points.join(", ")}\n\n`;
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `请根据以下详细的分段总结内容，生成一个结构化的思维导图 JSON 数据。\n\n**内容数据**：\n${consolidatedContent}`,
      config: {
        systemInstruction: MIND_MAP_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  children: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                         label: { type: Type.STRING },
                         children: { 
                           type: Type.ARRAY, 
                           items: { 
                             type: Type.OBJECT,
                             properties: {
                               label: { type: Type.STRING },
                               // Stop recursion here to prevent schema errors, 3 levels is usually enough for display
                               children: { 
                                 type: Type.ARRAY,
                                 items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        label: { type: Type.STRING }
                                    }
                                 },
                                 nullable: true 
                               }
                             }
                           }, 
                           nullable: true 
                         }
                      }
                    }
                  }
                },
                required: ["label"]
              }
            }
          },
          required: ["label", "children"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as MindMapNode;
  } catch (error) {
    console.error("Error generating mind map:", error);
    return null;
  }
};
