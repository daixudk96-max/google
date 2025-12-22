import React, { useState } from 'react';
import { MindMapNode } from '../types';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';

interface MindMapRendererProps {
  data: MindMapNode | null;
}

const TreeNode: React.FC<{ node: MindMapNode; level: number; isLast: boolean }> = ({ node, level, isLast }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  // Determine colors based on level
  const colors = [
    'border-indigo-500 bg-indigo-50 text-indigo-900', // Root
    'border-blue-400 bg-blue-50 text-blue-900',       // Level 1
    'border-sky-300 bg-sky-50 text-sky-800',          // Level 2
    'border-slate-300 bg-white text-slate-700',       // Level 3+
  ];
  const colorClass = colors[Math.min(level, colors.length - 1)];

  return (
    <div className="relative flex flex-col">
      <div className="flex items-center">
        {/* Connection Line (Horizontal) */}
        {level > 0 && (
          <div className="w-8 h-px bg-gray-300 flex-shrink-0"></div>
        )}

        {/* Node Content */}
        <div 
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-l-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${colorClass} max-w-md`}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {hasChildren && (
            <div className="text-gray-400 hover:text-gray-600">
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
          {!hasChildren && <Circle size={8} className="text-gray-300 fill-current" />}
          
          <span className={`font-medium ${level === 0 ? 'text-lg' : 'text-sm'}`}>
            {node.label}
          </span>
        </div>
      </div>

      {/* Children Container */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col ml-8 relative">
           {/* Vertical Line connecting children */}
           <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-gray-300"></div>
           
           <div className="py-2">
             {node.children!.map((child, idx) => (
               <div key={idx} className="relative pl-4 py-2">
                  {/* Horizontal curve/connector for child */}
                  <div className="absolute left-[-16px] top-6 w-4 h-px bg-gray-300"></div>
                  <TreeNode 
                    node={child} 
                    level={level + 1} 
                    isLast={idx === node.children!.length - 1} 
                  />
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

const MindMapRenderer: React.FC<MindMapRendererProps> = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-gray-500">无法生成思维导图</div>;

  return (
    <div className="w-full overflow-x-auto p-8 bg-slate-50/50 rounded-xl border border-slate-200 min-h-[500px]">
      <div className="min-w-max">
        <TreeNode node={data} level={0} isLast={true} />
      </div>
    </div>
  );
};

export default MindMapRenderer;
