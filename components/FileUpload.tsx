import React, { useState } from 'react';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { parseFile } from '../services/fileParsingService';

interface FileUploadProps {
  onFileUpload: (content: string, fileName: string) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled }) => {
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.md') && !lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
      alert('不支持的文件格式。请上传 .txt, .md, .pdf 或 .docx');
      return;
    }

    setIsParsing(true);
    try {
      const content = await parseFile(file);
      onFileUpload(content, file.name);
    } catch (error) {
      console.error(error);
      alert('解析文件失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsParsing(false);
    }
  };

  const isBusy = disabled || isParsing;

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <label
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
        ${isBusy 
          ? 'bg-gray-100 border-gray-300 cursor-not-allowed' 
          : 'bg-white border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm'
        }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isParsing ? (
             <Loader2 className="w-12 h-12 text-indigo-500 mb-4 animate-spin" />
          ) : isBusy ? (
            <FileText className="w-12 h-12 text-gray-400 mb-4" />
          ) : (
            <UploadCloud className="w-12 h-12 text-indigo-500 mb-4" />
          )}
          
          <p className="mb-2 text-lg text-gray-700 font-medium">
            {isParsing ? '正在解析文件...' : (disabled ? '处理中...' : '点击或拖拽上传文件')}
          </p>
          <p className="text-sm text-gray-500">
             支持 .txt, .md, .pdf, .docx (建议数万字中文长文本)
          </p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".txt,.md,.pdf,.docx" 
          onChange={handleFileChange} 
          disabled={isBusy}
        />
      </label>
    </div>
  );
};

export default FileUpload;
