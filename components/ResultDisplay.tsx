import React from 'react';
import { Segment } from '../types';
import { FileText, Download, Share2 } from 'lucide-react';
import UnifiedMapRenderer from './UnifiedMapRenderer';

interface ResultDisplayProps {
  segments: Segment[];
  fileName: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ segments, fileName }) => {
  if (!segments || segments.length === 0) return null;

  const downloadMarkdown = () => {
    let content = `# ${fileName} - 详细教程\n\n`;
    segments.forEach((seg, i) => {
      content += `## ${i + 1}. ${seg.main_title}\n`;
      if (seg.timestamp_start) content += `> 时间戳: ${seg.timestamp_start} - ${seg.timestamp_end}\n`;
      content += `\n`;
      
      seg.sub_segments.forEach(sub => {
        content += `### ${sub.title}\n`;
        content += `*${sub.overview}*\n\n`;
        
        sub.content_nodes.forEach(node => {
          content += `#### ${node.heading}\n`;
          content += `${node.text}\n\n`;
        });

        if (sub.key_points.length > 0) {
          content += `**核心要点**:\n`;
          sub.key_points.forEach(kp => content += `- ${kp}\n`);
          content += `\n`;
        }
        if (sub.original_snippet) {
          content += `> 原文: ${sub.original_snippet}\n\n`;
        }
        content += `\n`;
      });
      content += `---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_Tutorial.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  // Helper to build recursive OPML structure from indented text
  const buildOpmlFromText = (text: string) => {
    const lines = text.split('\n');
    
    // Tree Node Structure
    interface OpmlNode {
        text: string;
        children: OpmlNode[];
        note?: string;
    }

    const roots: OpmlNode[] = [];
    // Stack tracks: { node, indentLevel }
    const stack: { node: OpmlNode; indent: number }[] = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Calculate indentation (number of spaces)
        const indent = line.search(/\S|$/);
        
        // Check if it's a list item (- or • or *)
        const isListItem = /^[-\u2022*]/.test(trimmed);
        
        // CLEANUP: Remove the bullet point AND following spaces for the final text
        // This ensures XMind/MindNode gets "Text" not "- Text"
        const content = trimmed.replace(/^[-\u2022*]\s*/, '').trim();

        if (isListItem) {
            const newNode: OpmlNode = { text: content, children: [] };
            
            // Logic: Find the parent by looking at the stack.
            // Pop items from stack that are deeper or same level as current indent
            // (Because if indent is <= previous, we are back up the tree or at a sibling)
            while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }

            if (stack.length === 0) {
                // Top level node
                roots.push(newNode);
            } else {
                // Child of the current top of stack
                stack[stack.length - 1].node.children.push(newNode);
            }
            // Push current node as the active parent for subsequent deeper lines
            stack.push({ node: newNode, indent });
        } else {
            // It's not a list item, treat as a NOTE for the node currently at top of stack
            if (stack.length > 0) {
                 const current = stack[stack.length - 1].node;
                 current.note = current.note ? current.note + '\n' + content : content;
             }
        }
    });

    // Recursive function to generate XML
    const nodesToXml = (nodes: OpmlNode[], indentStr: string): string => {
        let xml = '';
        nodes.forEach(node => {
            const noteAttr = node.note ? ` _note="${escapeXml(node.note)}"` : '';
            if (node.children.length > 0) {
                // Has children
                xml += `${indentStr}<outline text="${escapeXml(node.text)}"${noteAttr}>\n`;
                xml += nodesToXml(node.children, indentStr + '  ');
                xml += `${indentStr}</outline>\n`;
            } else {
                // Leaf node
                xml += `${indentStr}<outline text="${escapeXml(node.text)}"${noteAttr} />\n`;
            }
        });
        return xml;
    };

    return nodesToXml(roots, '        ');
  };

  const downloadOPML = () => {
    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(fileName)} - 知识导图</title>
  </head>
  <body>
`;
    segments.forEach(seg => {
      opml += `    <outline text="${escapeXml(seg.main_title)}" >\n`;
      seg.sub_segments.forEach(sub => {
        // Sub-segment is a node
        opml += `      <outline text="${escapeXml(sub.title)}" _note="${escapeXml(sub.overview)}">\n`;
        
        // 1. Content Nodes (The real tree)
        sub.content_nodes.forEach(node => {
           opml += `        <outline text="${escapeXml(node.heading)}">\n`;
           // Use the tree parser here to convert indented text to nested outline
           opml += buildOpmlFromText(node.text);
           opml += `        </outline>\n`;
        });

        // 2. Key Points
        if (sub.key_points.length > 0) {
           opml += `        <outline text="核心要点">\n`;
           sub.key_points.forEach(kp => {
             opml += `          <outline text="${escapeXml(kp)}" />\n`;
           });
           opml += `        </outline>\n`;
        }
        
        opml += `      </outline>\n`;
      });
      opml += `    </outline>\n`;
    });

    opml += `  </body>\n</opml>`;

    const blob = new Blob([opml], { type: 'text/x-opml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_MindMap.opml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-gray-200 gap-4 sticky top-16 bg-slate-50/95 backdrop-blur z-20 pt-4">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          <div>
             <h2 className="text-2xl font-bold text-gray-800 leading-none truncate max-w-md">
              {fileName}
            </h2>
            <p className="text-sm text-gray-500 mt-1">深度自学教程 • 共 {segments.length} 章节</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={downloadMarkdown}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 font-medium transition-all shadow-sm"
          >
            <Download size={16} />
            导出 Markdown
          </button>
          <button
            onClick={downloadOPML}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all shadow-md shadow-indigo-200"
          >
            <Share2 size={16} />
            导出脑图 (OPML)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 min-h-[600px] overflow-hidden">
        <UnifiedMapRenderer segments={segments} />
      </div>
    </div>
  );
};

export default ResultDisplay;
