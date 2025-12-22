import * as pdfjsLibProxy from 'pdfjs-dist';
import mammoth from 'mammoth';

// Handle ES module default export inconsistency behavior in some environments
// This ensures we get the actual library object whether it's a default export or named exports
const pdfjsLib = (pdfjsLibProxy as any).default || pdfjsLibProxy;

// Configure worker for PDF.js
// We use the same version as defined in the import map
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
} else {
  console.warn("Could not set PDF worker source: GlobalWorkerOptions not found");
}

export const parseFile = async (file: File): Promise<string> => {
  const name = file.name.toLowerCase();
  
  try {
    if (name.endsWith('.pdf')) {
      return await parsePdf(file);
    } else if (name.endsWith('.docx')) {
      return await parseDocx(file);
    } else {
      // Default to text parsing for .txt, .md, etc.
      return await parseText(file);
    }
  } catch (error) {
    console.error("File parsing error:", error);
    throw new Error(`无法解析文件: ${file.name}. 请确保文件未损坏或格式正确。`);
  }
};

const parseText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read text file"));
    reader.readAsText(file);
  });
};

const parsePdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Ensure we have access to getDocument
  if (!pdfjsLib.getDocument) {
    throw new Error("PDF parser not initialized correctly (getDocument missing)");
  }

  // Using generic type for loadingTask to avoid strict type issues
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  // Loop through all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // items has 'str' property
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
      
    fullText += pageText + '\n\n';
  }
  
  return fullText;
};

const parseDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  // Mammoth might also be wrapped in default export depending on environment
  const mammothLib = (mammoth as any).default || mammoth;
  const result = await mammothLib.extractRawText({ arrayBuffer });
  return result.value;
};
