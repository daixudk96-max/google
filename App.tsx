import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultDisplay from './components/ResultDisplay';
import { splitTextIntoChunks, analyzeChunk, stitchResults, generateMindMap } from './services/geminiService';
import { ChunkAnalysisResult, ProcessingState, Segment, MindMapNode } from './types';
import { Loader2, BrainCircuit, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    currentChunk: 0,
    totalChunks: 0,
  });
  const [finalSegments, setFinalSegments] = useState<Segment[]>([]);
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileUpload = async (content: string, name: string) => {
    setFileName(name);
    setFinalSegments([]); 
    setMindMapData(null);
    setProcessingState({ status: 'chunking', currentChunk: 0, totalChunks: 0, message: '正在切片文本...' });

    try {
      // 1. Chunking (10k chars per chunk as requested)
      const chunks = splitTextIntoChunks(content, 10000);
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
          message: `正在进行深度解析切片 ${i + 1} / ${chunks.length} (教程模式，耗时较长请耐心等待)...`
        }));

        const result = await analyzeChunk(chunks[i], i, previousSummaryContext);
        results.push(result);

        // Update context for next iteration
        if (result.segments.length > 0) {
           const lastSeg = result.segments[result.segments.length - 1];
           if (lastSeg.sub_segments.length > 0) {
             previousSummaryContext = lastSeg.sub_segments[lastSeg.sub_segments.length - 1].summary;
           } else {
             previousSummaryContext = lastSeg.main_title;
           }
        }
      }

      // 3. Stitching
      setProcessingState(prev => ({ ...prev, status: 'stitching', message: '正在整合全部分段...' }));
      const stitchedSegments = stitchResults(results);
      setFinalSegments(stitchedSegments);

      // 4. Mind Mapping
      setProcessingState(prev => ({ ...prev, status: 'mindmapping', message: '正在绘制逻辑思维导图...' }));
      const mindMap = await generateMindMap(stitchedSegments);
      setMindMapData(mindMap);

      setProcessingState({ status: 'complete', currentChunk: chunks.length, totalChunks: chunks.length, message: '完成' });

    } catch (error) {
      console.error(error);
      setProcessingState({ 
        status: 'error', 
        currentChunk: 0, 
        totalChunks: 0, 
        message: '处理过程中发生错误，请检查 API Key 或重试。' 
      });
    }
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
              分段总结大师 (教程版)
            </h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block font-medium">
            Powered by Gemini 1.5 Pro
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* Intro / Empty State */}
        {processingState.status === 'idle' && (
          <div className="text-center mb-12 max-w-3xl mx-auto animate-fade-in-up">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-6">
              长文本 <span className="text-indigo-600">自学教程</span> 生成器
            </h2>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              上传数万字的会议记录、课程讲稿或文档。我们将为您生成<strong className="text-indigo-700">极度详尽</strong>的自学教材，并自动绘制全篇<strong className="text-indigo-700">思维导图</strong>。
            </p>
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
              {processingState.status === 'mindmapping' ? (
                <BrainCircuit className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
              ) : (
                <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-indigo-600" />
              )}
            </div>
            
            <h3 className="text-2xl font-bold text-slate-800 mb-3">{processingState.message}</h3>
            
            {processingState.totalChunks > 0 && processingState.status !== 'mindmapping' && (
              <div className="w-full bg-gray-100 rounded-full h-3 mt-6 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 h-3 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${(processingState.currentChunk / processingState.totalChunks) * 100}%` }}
                ></div>
              </div>
            )}
            
            <p className="text-base text-slate-500 mt-6 font-medium">
              {processingState.status === 'mindmapping' 
                ? '正在根据全篇内容构建知识图谱，请稍候...' 
                : 'AI 正在深度阅读并编写教程，这可能需要几分钟。'}
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
                    setMindMapData(null);
                  }}
                  className="px-8 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-50 font-bold shadow-sm transition-all hover:shadow-md flex items-center gap-2"
               >
                 <BrainCircuit className="w-5 h-5" />
                 分析新文件
               </button>
            </div>
            <ResultDisplay segments={finalSegments} mindMapData={mindMapData} fileName={fileName} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
