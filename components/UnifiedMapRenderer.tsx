import React, { useState } from 'react';
import { Segment, SubSegment, ContentNode } from '../types';
import { ChevronRight, ChevronDown, CheckCircle2, Quote, BookOpen, Clock, Lightbulb, Hash } from 'lucide-react';

interface UnifiedMapRendererProps {
  segments: Segment[];
}

// Pastel color palette for distinguishing segments
const COLOR_PALETTES = [
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-100', icon: 'text-orange-600' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-100', icon: 'text-blue-600' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'bg-emerald-100', icon: 'text-emerald-600' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', accent: 'bg-violet-100', icon: 'text-violet-600' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', accent: 'bg-rose-100', icon: 'text-rose-600' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', accent: 'bg-cyan-100', icon: 'text-cyan-600' },
];

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Strip bold markdown just in case
  const cleanText = text.replace(/\*\*/g, '');
  
  const lines = cleanText.split('\n').filter(line => line.trim() !== '');

  // Detect if this block looks like a list
  const isListLike = lines.every(line => line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.match(/^\s+[-•]/));

  if (isListLike) {
    return (
      <ul className="space-y-1.5 list-none">
        {lines.map((line, idx) => {
           // Calculate indentation level roughly based on spaces
           const leadingSpaces = line.search(/\S|$/);
           const indentClass = leadingSpaces >= 2 ? 'ml-6 border-l-2 border-indigo-100 pl-2' : '';
           const content = line.trim().replace(/^[-•]\s+/, '');
           
           return (
             <li key={idx} className={`flex gap-2 items-start text-slate-700 leading-7 ${indentClass}`}>
               <span className={`mt-2.5 w-1.5 h-1.5 rounded-full shrink-0 ${leadingSpaces >= 2 ? 'bg-slate-300 w-1 h-1' : 'bg-indigo-400'}`}></span>
               <span>{content}</span>
             </li>
           );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        // Handle basic list items even in mixed content
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
           return (
             <div key={idx} className="flex gap-2 items-start text-slate-700 leading-7 ml-2">
               <span className="text-slate-400 mt-2.5 w-1 h-1 rounded-full bg-slate-400 shrink-0"></span>
               <span>{trimmed.replace(/^[-•]\s+/, '')}</span>
             </div>
           );
        }
        return (
          <div key={idx} className="leading-7 text-slate-700">
             {line}
          </div>
        );
      })}
    </div>
  );
};

const ContentNodeItem: React.FC<{ node: ContentNode; palette: any }> = ({ node, palette }) => (
  <div className="mb-6 last:mb-0 relative pl-4 border-l-2 border-slate-200 hover:border-slate-400 transition-colors">
    <div className={`font-bold ${palette.text} mb-3 flex items-baseline gap-2 text-lg`}>
       <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0 self-center"></span>
       {node.heading}
    </div>
    <div className="text-base text-justify">
      <FormattedText text={node.text} />
    </div>
  </div>
);

const SubSegmentNode: React.FC<{ sub: SubSegment; isLast: boolean; palette: any }> = ({ sub, isLast, palette }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative pl-6 md:pl-8">
      {/* Vertical connector from parent */}
      <div className={`absolute left-0 top-0 w-px bg-slate-200 ${isLast ? 'h-8' : 'h-full'}`}></div>
      {/* Horizontal connector to node */}
      <div className="absolute left-0 top-8 w-6 md:w-8 h-px bg-slate-200"></div>

      <div className="mb-8 group">
        {/* Node Header */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`bg-white border ${palette.border} rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-3 relative z-10`}
        >
          <div className="mt-1 text-slate-400 group-hover:text-slate-600 transition-colors">
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
          
          <div className="flex-grow">
            <h4 className={`font-bold ${palette.text} text-xl mb-1`}>{sub.title}</h4>
            <p className="text-slate-500 text-sm">{sub.overview}</p>
          </div>
        </div>

        {/* Node Content (Detailed) */}
        {isOpen && (
          <div className="mt-4 ml-2 pl-4 md:pl-6 border-l-2 border-dashed border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
            
            {/* Structured Content Nodes */}
            <div className={`bg-white rounded-xl p-6 md:p-8 border ${palette.border} shadow-sm mb-6`}>
               {sub.content_nodes.map((node, i) => (
                 <ContentNodeItem key={i} node={node} palette={palette} />
               ))}
            </div>

            {/* Key Points */}
            {sub.key_points && sub.key_points.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                 {sub.key_points.map((point, idx) => (
                   <div key={idx} className={`${palette.bg} border ${palette.border} px-3 py-1.5 rounded-lg text-sm ${palette.text} font-medium flex items-center gap-1.5`}>
                     <CheckCircle2 size={14} className={palette.icon} />
                     <span>{point}</span>
                   </div>
                 ))}
              </div>
            )}

            {/* Original Snippet */}
            {sub.original_snippet && (
              <div className="flex gap-3 text-slate-500 italic text-sm px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                <Quote size={14} className="shrink-0 mt-0.5" />
                <p>"{sub.original_snippet}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SegmentNode: React.FC<{ segment: Segment; index: number }> = ({ segment, index }) => {
  const [isOpen, setIsOpen] = useState(true);
  const palette = COLOR_PALETTES[index % COLOR_PALETTES.length];

  return (
    <div className={`relative mb-12 rounded-3xl p-4 md:p-8 ${palette.bg} border ${palette.border}`}>
      
      {/* Chapter Marker */}
      <div className="absolute -left-3 md:-left-4 top-8">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${palette.accent} border-2 border-white text-slate-700 flex items-center justify-center font-bold text-lg shadow-sm z-10`}>
          {index + 1}
        </div>
      </div>

      {/* Root Node (Segment Title) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 cursor-pointer group mb-8 ml-4 md:ml-6"
      >
        <div className="flex-grow flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
          <div>
            <h3 className={`text-3xl font-black ${palette.text} tracking-tight leading-tight`}>{segment.main_title}</h3>
            <div className="flex items-center gap-3 mt-3 text-sm text-slate-600 font-medium opacity-80">
              <span className="bg-white/60 px-2 py-0.5 rounded border border-black/5">依据: {segment.segmentation_reason}</span>
              {(segment.timestamp_start || segment.timestamp_end) && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {segment.timestamp_start || '00:00'} - {segment.timestamp_end || 'End'}
                </span>
              )}
            </div>
          </div>
          <div className={`${palette.text} opacity-50`}>
             {isOpen ? <ChevronDown /> : <ChevronRight />}
          </div>
        </div>
      </div>

      {/* Children Container */}
      {isOpen && (
        <div className="ml-2 md:ml-4 pb-2">
          {segment.sub_segments.map((sub, idx) => (
            <SubSegmentNode 
              key={`${segment.id}-sub-${idx}`} 
              sub={sub} 
              isLast={idx === segment.sub_segments.length - 1} 
              palette={palette}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UnifiedMapRenderer: React.FC<UnifiedMapRendererProps> = ({ segments }) => {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
       <div className="mb-16 text-center">
           <div className="inline-flex items-center justify-center p-4 bg-indigo-50 rounded-full mb-6">
             <BookOpen className="text-indigo-600 w-10 h-10" />
           </div>
           <h2 className="text-4xl font-black text-slate-800 tracking-tight">
             全篇深度讲义
           </h2>
           <p className="text-lg text-slate-500 mt-3">结构化重构 • 视觉清单 • 纯净文本</p>
        </div>
        
        <div className="space-y-8">
          {segments.map((seg, idx) => (
            <SegmentNode key={seg.id || idx} segment={seg} index={idx} />
          ))}
        </div>
        
        <div className="mt-16 text-center text-slate-400 text-sm">
          <p>End of Tutorial</p>
        </div>
    </div>
  );
};

export default UnifiedMapRenderer;
