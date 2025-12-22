import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultDisplay from './components/ResultDisplay';
import { splitTextIntoChunks, analyzeChunk, stitchResults } from './services/geminiService';
import { ChunkAnalysisResult, ProcessingState, Segment, SEGMENT_MASTER_SYSTEM_PROMPT } from './types';
import { Loader2, BrainCircuit, AlertCircle, Settings2, Sparkles, Copy } from 'lucide-react';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    currentChunk: 0,
    totalChunks: 0,
  });
  const [finalSegments, setFinalSegments] = useState<Segment[]>([]);
  const [fileName, setFileName] = useState<string>('');
  
  // AI Configuration State
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(SEGMENT_MASTER_SYSTEM_PROMPT);
  const [thinkingBudget, setThinkingBudget] = useState(0); // Default 0 (Disabled)

  const handleFileUpload = async (content: string, name: string) => {
    setFileName(name);
    setFinalSegments([]); 
    setProcessingState({ status: 'chunking', currentChunk: 0, totalChunks: 0, message: '正在切片文本...' });

    try {
      // 1. Chunking (2400 chars per chunk for higher granularity)
      const chunks = splitTextIntoChunks(content, 2400);
      setProcessingState({ 
        status: 'analyzing', 
        currentChunk: 0, 
        totalChunks: chunks.length,
        message: `准备处理 ${chunks.length} 个切片...`
      });

      const results: ChunkAnalysisResult[] = [];
      let previousSummaryContext = "";

      // 2. Sequential Analysis (High Detail)
      for (let i = 0; i < chunks.length; i++) {
        setProcessingState(prev => ({
          ...prev,
          currentChunk: i + 1,
          message: `正在进行深度解析切片 ${i + 1} / ${chunks.length} ${thinkingBudget > 0 ? '(深度思考中...)' : ''}...`
        }));

        // Pass systemPrompt and thinkingBudget from state
        const result = await analyzeChunk(chunks[i], i, systemPrompt, thinkingBudget, previousSummaryContext);
        results.push(result);

        // Update context for next iteration
        if (result.segments.length > 0) {
           const lastSeg = result.segments[result.segments.length - 1];
           if (lastSeg.sub_segments.length > 0) {
             const lastSub = lastSeg.sub_segments[lastSeg.sub_segments.length - 1];
             previousSummaryContext = lastSub.overview;
           } else {
             previousSummaryContext = lastSeg.main_title;
           }
        }
      }

      // 3. Stitching
      setProcessingState(prev => ({ ...prev, status: 'stitching', message: '正在整合全部分段...' }));
      const stitchedSegments = stitchResults(results);
      setFinalSegments(stitchedSegments);

      setProcessingState({ status: 'complete', currentChunk: chunks.length, totalChunks: chunks.length, message: '完成' });

    } catch (error) {
      console.error(error);
      setProcessingState({ 
        status: 'error', 
        currentChunk: 0, 
        totalChunks: 0, 
        message: '处理过程中发生错误，请检查 API Key 或网络。' 
      });
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt);
    alert('系统提示词已复制！你可以将其粘贴到 Google AI Studio 或 Gemini Gem 中。');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-200">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Gemini 深度脑图工坊
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
             >
               <Settings2 size={16} />
               Gem 配置
             </button>
             <div className="text-sm text-slate-500 hidden sm:block font-medium pl-3 border-l border-slate-200">
              Gemini 3 Flash
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* Intro / Empty State */}
        {processingState.status === 'idle' && (
          <div className="text-center mb-10 max-w-3xl mx-auto animate-fade-in-up">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              打造你的专属 <span className="text-indigo-600">AI 知识应用</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              上传长文档，自动执行深度拆解工作流。支持自定义 Gem 人设与思维链预算。
            </p>
          </div>
        )}

        {/* AI Configuration Panel */}
        {showSettings && processingState.status === 'idle' && (
          <div className="max-w-4xl mx-auto mb-10 bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
             <div className="bg-indigo-50/50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
               <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                 <Sparkles size={18} className="text-indigo-600" />
                 Gem 核心配置
               </h3>
               <button onClick={copyPrompt} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline">
                 <Copy size={12} /> 复制提示词
               </button>
             </div>
             
             <div className="p-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                   <label className="block text-sm font-medium text-slate-700">
                     System Prompt (Gem 人设)
                   </label>
                   <p className="text-xs text-slate-500 mb-2">定义 AI 如何拆解、归纳和输出思维导图结构。</p>
                   <textarea 
                     value={systemPrompt}
                     onChange={(e) => setSystemPrompt(e.target.value)}
                     className="w-full h-64 p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono resize-none leading-relaxed"
                   />
                </div>
                
                <div className="space-y-6">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">
                       Thinking Budget (思考预算)
                     </label>
                     <div className="flex items-center gap-4 mb-2">
                        <span className="text-2xl font-bold text-indigo-600">{thinkingBudget}</span>
                        <span className="text-xs text-slate-500">Tokens</span>
                     </div>
                     <input 
                       type="range" 
                       min="0" 
                       max="8192" 
                       step="1024" 
                       value={thinkingBudget}
                       onChange={(e) => setThinkingBudget(Number(e.target.value))}
                       className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                     />
                     <p className="text-xs text-slate-500 mt-2">
                       {thinkingBudget === 0 
                         ? '已关闭。适合快速生成，响应速度最快。' 
                         : '已开启深度思考。AI 将在生成回答前进行逻辑推理 (Gemini 3.0 特性)，会增加等待时间但提升准确率。'}
                     </p>
                   </div>
                   
                   <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                      <h4 className="text-sm font-bold text-amber-800 mb-1">提示技巧</h4>
                      <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                        <li>保留 <b>NO DUNHAO</b> 指令以确保导图格式正确。</li>
                        <li>保留 <b>Content Node 格式规范</b> 以确保渲染器能识别。</li>
                        <li>增加“思考预算”可显著提升复杂逻辑归纳的效果。</li>
                      </ul>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Upload Section */}
        {processingState.status === 'idle' && (
          <FileUpload onFileUpload={handleFileUpload} />
        )}

        {/* Processing Indicator */}
        {(processingState.status !== 'idle' && processingState.status !== 'complete' && processingState.status !== 'error') && (
          <div className="max-w-xl mx-auto bg-white p-10 rounded-2xl shadow-xl border border-indigo-100 text-center mb-12 animate-pulse-slow">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 border-[6px] border-indigo-50 rounded-full"></div>
              <div className="absolute inset-0 border-[6px] border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-indigo-600" />
            </div>
            
            <h3 className="text-2xl font-bold text-slate-800 mb-3">{processingState.message}</h3>
            
            {processingState.totalChunks > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-3 mt-6 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 h-3 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${(processingState.currentChunk / processingState.totalChunks) * 100}%` }}
                ></div>
              </div>
            )}
            
            <p className="text-base text-slate-500 mt-6 font-medium">
              AI 正在执行工作流：{thinkingBudget > 0 ? '深度推理' : '快速分析'} -> 逻辑拆解 -> 结构重组
            </p>
          </div>
        )}

        {/* Error State */}
        {processingState.status === 'error' && (
          <div className="max-w-2xl mx-auto bg-red-50 p-6 rounded-xl border border-red-200 flex items-start gap-4 mb-8">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 text-lg">处理失败</h3>
              <p className="text-red-600 mt-2">{processingState.message}</p>
              <button 
                onClick={() => setProcessingState({ status: 'idle', currentChunk: 0, totalChunks: 0 })}
                className="mt-6 px-6 py-2.5 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {processingState.status === 'complete' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-center mb-8">
               <button 
                  onClick={() => {
                    setProcessingState({ status: 'idle', currentChunk: 0, totalChunks: 0 });
                    setFinalSegments([]);
                    setFileName('');
                  }}
                  className="px-8 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-50 font-bold shadow-sm transition-all hover:shadow-md flex items-center gap-2"
               >
                 <BrainCircuit className="w-5 h-5" />
                 分析新文件
               </button>
            </div>
            <ResultDisplay segments={finalSegments} fileName={fileName} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
