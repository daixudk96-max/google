import React, { useState } from 'react';
import { Segment, SubSegment, MindMapNode } from '../types';
import { FileText, Clock, Tag, CheckCircle2, ListTree, BookOpen } from 'lucide-react';
import MindMapRenderer from './MindMapRenderer';

interface ResultDisplayProps {
  segments: Segment[];
  mindMapData: MindMapNode | null;
  fileName: string;
}

const SubSegmentCard: React.FC<{ sub: SubSegment; index: number }> = ({ sub, index }) => (
  <div className="ml-4 md:ml-8 mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm ring-2 ring-indigo-50">
          {index + 1}
        </div>
      </div>
      <div className="flex-grow space-y-4">
        <h4 className="text-xl font-bold text-slate-800">{sub.title}</h4>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border-l-4 border-indigo-200">
           {/* Allow basic formatting if API returns newlines */}
           {sub.summary.split('\n').map((line, i) => (
             <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-2'}>{line}</p>
           ))}
        </div>
        
        {sub.key_points && sub.key_points.length > 0 && (
          <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
             <h5 className="text-sm font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> 核心知识点
             </h5>
             <ul className="grid grid-cols-1 gap-3">
               {sub.key_points.map((kp, idx) => (
                 <li key={idx} className="flex items-start gap-2 text-slate-800 text-sm md:text-base font-medium">
                   <span className="text-green-500 mt-1">•</span>
                   <span>{kp}</span>
                 </li>
               ))}
             </ul>
          </div>
        )}

        {sub.original_snippet && (
          <div className="text-sm text-slate-500 italic mt-2">
            <span className="font-semibold text-slate-400">原文摘录：</span> "{sub.original_snippet}"
          </div>
        )}
      </div>
    </div>
  </div>
);

const SegmentCard: React.FC<{ segment: Segment; index: number }> = ({ segment, index }) => (
  <div className="mb-12 relative pl-6 md:pl-0">
    {/* Timeline Connector for Desktop */}
    <div className="hidden md:block absolute left-[27px] top-10 bottom-[-48px] w-0.5 bg-indigo-100 last:hidden"></div>

    <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">
      {/* Segment Number Badge */}
      <div className="flex-shrink-0 z-10 hidden md:flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-xl ring-4 ring-indigo-50">
          {index + 1}
        </div>
      </div>

      <div className="flex-grow w-full">
        {/* Main Segment Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-violet-800 rounded-2xl p-6 shadow-lg text-white mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4">
             <BookOpen size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 opacity-90 text-sm font-medium uppercase tracking-wide">
                  <Tag className="w-4 h-4" />
                  <span>Tutorial Section {index + 1}</span>
                </div>
                <h3 className="text-3xl font-extrabold tracking-tight leading-tight">{segment.main_title}</h3>
              </div>
              {(segment.timestamp_start || segment.timestamp_end) && (
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg text-sm font-mono backdrop-blur-sm shadow-sm border border-white/10">
                  <Clock className="w-4 h-4" />
                  <span>
                    {segment.timestamp_start || '00:00:00'} — {segment.timestamp_end || 'End'}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-white/20 text-indigo-100 text-sm flex items-center gap-2">
              <span className="font-semibold text-indigo-200 bg-indigo-900/30 px-2 py-1 rounded">分段依据</span> 
              <span>{segment.segmentation_reason}</span>
            </div>
          </div>
        </div>

        {/* Sub-segments */}
        <div className="space-y-6">
          {segment.sub_segments.map((sub, idx) => (
            <SubSegmentCard key={`${segment.id}-sub-${idx}`} sub={sub} index={idx} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ResultDisplay: React.FC<ResultDisplayProps> = ({ segments, mindMapData, fileName }) => {
  const [activeTab, setActiveTab] = useState<'mindmap' | 'details'>('mindmap');

  if (!segments || segments.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          <div>
             <h2 className="text-2xl font-bold text-gray-800 leading-none">
              <span className="text-indigo-600">自学教程:</span> {fileName}
            </h2>
            <p className="text-sm text-gray-500 mt-1">共 {segments.length} 个主要章节 • 已生成思维导图</p>
          </div>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('mindmap')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'mindmap' 
                ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListTree className="w-4 h-4" />
            思维导图
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'details' 
                ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            详细内容
          </button>
        </div>
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'mindmap' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
                   <ListTree className="text-indigo-500" /> 
                   全篇逻辑思维导图
                </h3>
                <MindMapRenderer data={mindMapData} />
             </div>
          </div>
        ) : (
          <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
            {segments.map((seg, idx) => (
              <SegmentCard key={seg.id || idx} segment={seg} index={idx} />
            ))}
            
            <div className="mt-12 p-8 bg-indigo-50 rounded-2xl border border-indigo-100 text-center text-indigo-800">
              <BookOpen className="w-8 h-8 mx-auto mb-3 text-indigo-400" />
              <p className="font-medium text-lg">教程结束</p>
              <p className="text-sm mt-2 opacity-70">由 Gemini 分段总结大师生成</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultDisplay;
