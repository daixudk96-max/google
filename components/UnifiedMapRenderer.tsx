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

const cleanTimestamp = (ts?: string) => {
  if (!ts) return null;
  
  // 1. Split by underscore to handle "00:05_2025..." format
  let cleaned = ts.split('_')[0];

  // 2. Extract standard time pattern
  const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (timeMatch) return timeMatch[0];
  
  // 3. Fallback truncation
  return cleaned.length > 10 ? cleaned.substring(0, 8) : cleaned;
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Strip bold markdown just in case to avoid double styling
  const cleanText = text.replace(/\*\*/g, '');
  
  const lines = cleanText.split('\n').filter(line => line.trim() !== '');

  // Detect if this block looks like a list
  const isListLike = lines.every(line => line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.match(/^\s+[-•]/));

  if (isListLike) {
    return (
      <div className="flex flex-col">
        {lines.map((line, idx) => {
           // Calculate indentation level precisely based on spaces
           // Assuming 2 spaces = 1 level as per System Prompt instructions
           const spaceCount = line.search(/\S|$/);
           const level = Math.floor(spaceCount / 2);
           
           const content = line.trim().replace(/^[-•]\s+/, '');
           
           // VISUAL HIERARCHY LOGIC - UPDATED FONT SIZES
           // Level 0: Main Concept. XL, bold.
           // Level 1: Sub Concept / Explanation. LG, medium.
           // Level 2: Detail / Nuance. Base (standard).

           if (level === 0) {
             return (
               <div key={idx} className="flex gap-3 items-start mt-5 mb-3 first:mt-0 relative group">
                 <div className="mt-3 w-3 h-3 bg-indigo-600 rounded-full shrink-0 shadow-sm z-10" />
                 <span className="font-bold text-slate-800 text-xl leading-snug">{content}</span>
               </div>
             );
           }
           
           // Precise indentation calculation
           // Increased base indent to match larger fonts
           const baseIndentRem = 2.0; 
           const extraIndentRem = (level - 1) * 1.5;
           const totalIndentRem = baseIndentRem + extraIndentRem;

           return (
             <div 
               key={idx} 
               className="relative flex gap-3 items-start mt-2"
               style={{ paddingLeft: `${totalIndentRem}rem` }}
             >
               {/* Visual Guide Line: Vertical line connecting from parent area down to this item */}
               <div 
                  className="absolute border-l-2 border-slate-200/60" 
                  style={{ 
                    left: `${totalIndentRem - 1}rem`, 
                    top: '-0.5rem', 
                    bottom: '0.8rem',
                    width: '2px'
                  }} 
               />
               
               {/* Horizontal Connector */}
               <div 
                 className="absolute border-t-2 border-slate-200/60"
                 style={{ 
                    left: `${totalIndentRem - 1}rem`, 
                    top: '0.9rem', 
                    width: '0.8rem' 
                 }}
               />

               {/* Bullet Point */}
               <span 
                 className={`mt-3 shrink-0 rounded-full shadow-sm z-10 ${level === 1 ? 'w-2 h-2 bg-slate-500' : 'w-1.5 h-1.5 bg-slate-400'}`} 
               />
               
               {/* Text Content - Increased sizes */}
               <span className={`leading-relaxed ${level === 1 ? 'text-slate-700 font-medium text-lg' : 'text-slate-600 text-base'}`}>
                 {content}
               </span>
             </div>
           );
        })}
      </div>
    );
  }

  // Fallback for non-list text
  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
           return (
             <div key={idx} className="flex gap-2 items-start text-slate-700 leading-relaxed ml-2 text-lg">
               <span className="text-slate-400 mt-3 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
               <span>{trimmed.replace(/^[-•]\s+/, '')}</span>
             </div>
           );
        }
        return (
          <div key={idx} className="leading-relaxed text-slate-700 text-lg">
             {line}
          </div>
        );
      })}
    </div>
  );
};

const ContentNodeItem: React.FC<{ node: ContentNode; palette: any; index: number }> = ({ node, palette, index }) => {
  // Zebra striping logic: Even index = transparent (or white), Odd index = pale color
  const isOdd = index % 2 !== 0;
  
  return (
    <div className={`p-6 md:p-8 rounded-2xl border transition-all ${isOdd ? 'bg-slate-50/80 border-slate-200' : 'bg-white border-slate-100'} hover:border-indigo-200 mb-6 last:mb-0`}>
      <div className={`font-black ${palette.text} mb-4 flex items-baseline gap-3 text-2xl`}>
         {node.heading}
      </div>
      <div className="text-lg text-justify">
        <FormattedText text={node.text} />
      </div>
    </div>
  );
};

const SubSegmentNode: React.FC<{ sub: SubSegment; isLast: boolean; palette: any }> = ({ sub, isLast, palette }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative pl-6 md:pl-8">
      {/* Vertical connector from parent */}
      <div className={`absolute left-0 top-0 w-1 bg-slate-100 ${isLast ? 'h-10' : 'h-full'}`}></div>
      {/* Horizontal connector to node */}
      <div className="absolute left-0 top-10 w-6 md:w-8 h-1 bg-slate-100"></div>

      <div className="mb-10 group">
        {/* Node Header */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`bg-white border-2 ${palette.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-4 relative z-10`}
        >
          <div className="mt-1.5 text-slate-400 group-hover:text-slate-600 transition-colors">
            {isOpen ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
          </div>
          
          <div className="flex-grow">
            <h4 className={`font-bold ${palette.text} text-2xl mb-2`}>{sub.title}</h4>
            {sub.overview && <p className="text-slate-500 text-base font-medium">{sub.overview}</p>}
          </div>
        </div>

        {/* Node Content (Detailed) */}
        {isOpen && (
          <div className="mt-6 ml-3 pl-5 md:pl-7 border-l-2 border-dashed border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
            
            {/* Structured Content Nodes Container - Removed wrapper border to let zebra cards shine */}
            <div className="space-y-4">
               {sub.content_nodes.map((node, i) => (
                 <ContentNodeItem key={i} node={node} palette={palette} index={i} />
               ))}
            </div>

            {/* Key Points - Rendered minimally as tags at bottom if they exist */}
            {sub.key_points && sub.key_points.length > 0 && (
              <div className="mt-8 mb-6 flex flex-wrap gap-3 opacity-90">
                 {sub.key_points.map((point, idx) => (
                   <div key={idx} className={`bg-white border border-slate-200 px-4 py-2 rounded-full text-sm font-medium text-slate-600 flex items-center gap-2 shadow-sm`}>
                     <Hash size={12} className="text-indigo-400" />
                     <span>{point}</span>
                   </div>
                 ))}
              </div>
            )}

            {/* Original Snippet */}
            {sub.original_snippet && (
              <div className="flex gap-4 text-slate-500 italic text-base px-6 py-5 bg-slate-50 rounded-xl border border-slate-200/60 mt-6">
                <Quote size={20} className="shrink-0 mt-1 text-slate-300" />
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

  const startTime = cleanTimestamp(segment.timestamp_start);
  const endTime = cleanTimestamp(segment.timestamp_end);

  return (
    <div className={`relative mb-16 rounded-[2rem] p-6 md:p-10 ${palette.bg} border ${palette.border}`}>
      
      {/* Chapter Marker */}
      <div className="absolute -left-4 md:-left-6 top-10">
        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full ${palette.accent} border-4 border-white text-slate-700 flex items-center justify-center font-black text-2xl shadow-sm z-10`}>
          {index + 1}
        </div>
      </div>

      {/* Root Node (Segment Title) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-start gap-6 cursor-pointer group mb-10 ml-6 md:ml-8"
      >
        <div className="flex-grow w-full">
            <h3 className={`text-3xl md:text-4xl font-black ${palette.text} tracking-tight leading-tight mb-4`}>{segment.main_title}</h3>
            
            {/* Metadata Section - Optimized Layout */}
            <div className="flex flex-col md:flex-row md:items-start gap-3 text-base text-slate-600 font-medium opacity-80">
              <div className="flex-grow bg-white/60 px-4 py-3 rounded-lg border border-black/5 shadow-sm">
                 <span className="font-bold text-slate-700 block mb-1 text-xs uppercase tracking-wider">划分依据</span>
                 <span className="leading-relaxed text-sm block">{segment.segmentation_reason}</span>
              </div>
              
              {(startTime || endTime) && (
                <div className="flex items-center gap-2 bg-white/40 px-3 py-2 rounded-lg border border-transparent shrink-0 self-start md:self-auto">
                  <Clock size={16} />
                  <span className="whitespace-nowrap text-sm font-mono" title={`${segment.timestamp_start} - ${segment.timestamp_end}`}>
                    {startTime || '00:00'} - {endTime || 'End'}
                  </span>
                </div>
              )}
            </div>
        </div>
        
        <div className={`bg-white/50 p-2 rounded-full ${palette.text} opacity-60 hover:opacity-100 transition-opacity shrink-0 mt-2`}>
           {isOpen ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
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
       <div className="mb-20 text-center mt-8">
           <div className="inline-flex items-center justify-center p-5 bg-indigo-50 rounded-full mb-8 shadow-sm">
             <BookOpen className="text-indigo-600 w-12 h-12" />
           </div>
           <h2 className="text-5xl font-black text-slate-800 tracking-tight mb-4">
             全篇深度讲义
           </h2>
           <p className="text-xl text-slate-500 font-medium">结构化重构 • 视觉清单 • 纯净文本</p>
        </div>
        
        <div className="space-y-12">
          {segments.map((seg, idx) => (
            <SegmentNode key={seg.id || idx} segment={seg} index={idx} />
          ))}
        </div>
        
        <div className="mt-24 text-center text-slate-400 text-sm pb-10">
          <p>Generated by Gemini Segment Master</p>
        </div>
    </div>
  );
};

export default UnifiedMapRenderer;