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

**核心指令 2：概念独立化 (Separate Concepts)**
*   **严禁**将两个不同的主体挤在同一个 \`ContentNode\` 或同一行里。
*   必须创建**多个** \`ContentNode\` 或**不同的列表行**。

**核心指令 3：同类项归纳 (Group Common Prefixes)**
*   **这是当前最重要的指令**。
*   如果发现多个列表项有相同的开头（例如“核心受众：A”、“核心受众：B”），**必须**合并开头，将差异项作为子节点。
*   使用 **2个空格** 的缩进来表示子层级。

*   *错误示范 (重复啰嗦)*：
    - 核心受众：源头工厂
    - 核心受众：自有品牌方
    - 减法原则：舍弃复杂人设
    - 减法原则：无需过度社交

*   *正确示范 (合并归纳)*：
    - 核心受众
      - 源头工厂
      - 自有品牌方
    - 减法原则
      - 舍弃复杂人设
      - 无需过度社交

**核心指令 4：极高信息密度**
*   输入约 2400 字，输出保持在 800 字以上（信息留存率 > 30%）。
*   **不要**写成简略的摘要，要保留具体的知识点、数据和论据。

**Content Node 格式规范**：

1.  **Text 字段格式**：必须全都是以 \`- \` (减号+空格) 开头的列表项。
2.  **子节点**：使用 2个空格 + \`- \` 表示下一级。
3.  **短语化**：禁止完整句子，使用名词/动宾短语。
4.  **禁止标记**：严禁 \`**\` 加粗，严禁 \`1. 2. 3.\` 编号。

**正确示范 (Mind Map Mode)**：

Node 1 Heading: 达人IP逻辑
Text:
- 核心优先级
  - 社交优先
- 核心受众
  - C端消费者
  - 粉丝群体
- 变现路径
  - 信任带货
  - 广告植入

Node 2 Heading: 源头商家逻辑
Text:
- 核心优先级
  - 生意优先
- 核心受众
  - B端采购商
  - 渠道分销商
`;
