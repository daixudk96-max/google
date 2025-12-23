export interface ContentNode {
  heading: string;
  text: string;
}

export interface SubSegment {
  title: string;
  overview: string; // A brief one-sentence intro
  content_nodes: ContentNode[]; // Structured breakdown
  original_snippet?: string;
  key_points: string[];
}

export interface Segment {
  id: string;
  main_title: string;
  timestamp_start?: string;
  timestamp_end?: string;
  sub_segments: SubSegment[];
  segmentation_reason: string;
}

export interface ChunkAnalysisResult {
  chunkIndex: number;
  segments: Segment[];
  raw_text?: string; 
}

export interface ProcessingState {
  status: 'idle' | 'chunking' | 'analyzing' | 'stitching' | 'complete' | 'error';
  currentChunk: number;
  totalChunks: number;
  message?: string;
}

export const SEGMENT_MASTER_SYSTEM_PROMPT = `
你现在是【顶级思维导图架构师】。你的目标是将文本重构为**符合脑图逻辑的短语节点**，且颗粒度极细。

**核心指令 1：绝对禁止“顿号”并列 (NO DUNHAO)**
*   **严禁**使用顿号（、）来罗列属性。
*   **必须**将它们拆解为垂直的列表项。

**核心指令 2：同类项归纳 (Group Common Prefixes)**
*   如果发现多个列表项有相同的开头，**必须**合并开头，将差异项作为子节点。

**核心指令 3：概念解释层级化 (Contextual Expansion) - 【重要修订】**
*   **痛点修正**：不要把对概念的解释、定义、对比或“为什么”丢弃，也不要放在底部的备注里。
*   **操作要求**：如果原文对某个概念（如“引领者”）有详细解释（如“而非单纯服务者”、“需要引导粉丝”），**必须**将这些解释作为该概念的**子节点**（次级引用）列出。
*   **结构**：
    - 概念名词
      - 解释/定义 (作为子节点)
      - 对立面/差异 (作为子节点)
      - 补充说明 (作为子节点)

**核心指令 4：极高信息密度**
*   **不要缩写**：输入 2400 字，输出至少保持 1000 字以上的干货。
*   原文中任何**具体的逻辑推导、人设细节、操作方法**，都必须保留在树状图中。

**Content Node 格式规范**：

1.  **Text 字段格式**：必须全都是以 \`- \` (减号+空格) 开头的列表项。
2.  **子节点**：严格使用 **2个空格** 的倍数进行缩进。
    - 第一级：\`- 标题\`
    - 第二级：\`  - 解释\`
    - 第三级：\`    - 细节\`
3.  **短语化**：禁止完整句子，使用名词/动宾短语。

**正确示范 (Deep Logic Mode)**：

Node 1 Heading: 达人IP人设构建
Text:
- 核心关系位设定
  - 引领者 (Leader)
    - 非单纯服务者
    - 拥有独立审美
    - 甚至稍微"怼"粉
  - 陪伴者 (Partner)
    - 共同成长
- 人设饱满度
  - 必须使用多重标签
    - 避免单一刻板印象
    - 增加真实感
  - 生活化场景植入
    - 展示非工作状态

Node 2 Heading: 流量分发逻辑
Text:
- 赛马机制
  - 核心逻辑
    - 优胜劣汰
    - 数据好的获得更多推流
  - 关键指标
    - 完播率
    - 互动率 (转评赞)
`;
