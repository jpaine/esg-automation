import mammoth from 'mammoth';
// Use legacy build for Node.js/serverless compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

export interface ExtractedText {
  text: string;
  metadata?: {
    pages?: number;
    title?: string;
  };
}

/**
 * Enhanced error logging helper
 */
function logError(context: string, error: unknown, additionalInfo?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    context,
    error: error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : { message: String(error) },
    ...additionalInfo,
  };
  
  console.error(`[ERROR ${timestamp}] ${context}:`, JSON.stringify(errorDetails, null, 2));
  return errorDetails;
}

/**
 * Extract text from uploaded file
 */
export async function extractTextFromFile(
  file: File
): Promise<ExtractedText> {
  const startTime = Date.now();
  const fileInfo = {
    name: file.name,
    type: file.type,
    size: file.size,
  };
  
  console.log(`[INFO] Starting text extraction for file: ${file.name} (${file.size} bytes, type: ${file.type})`);
  
  const buffer = await file.arrayBuffer();
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Handle PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    console.log(`[INFO] Processing PDF file: ${file.name}`);
    
    try {
      console.log('[INFO] Starting PDF extraction with pdfjs-dist...');
      const parseStartTime = Date.now();
      
      // Configure pdfjs-dist for serverless (disable workers, use legacy build)
      // This avoids worker file issues in serverless environments
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // Disable workers for serverless
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        verbosity: 0, // Suppress warnings
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      console.log(`[INFO] PDF loaded: ${numPages} pages`);
      
      // Extract text from all pages
      let fullText = '';
      const pageTexts: string[] = [];
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items from the page
        const pageText = textContent.items
          .map((item: any) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .trim();
        
        if (pageText) {
          pageTexts.push(pageText);
          fullText += pageText + '\n\n';
        }
      }
      
      const parseTime = Date.now() - parseStartTime;
      
      console.log(`[INFO] pdfjs-dist extraction completed in ${parseTime}ms`, {
        pages: numPages,
        textLength: fullText.length,
        hasText: fullText.trim().length > 0,
        pagesWithText: pageTexts.filter(t => t.length > 0).length,
      });
      
      if (!fullText || !fullText.trim()) {
        const error = new Error('No text extracted from PDF - document may be image-based, encrypted, or empty');
        logError('pdfjs-dist returned empty text', error, {
          fileInfo,
          numPages,
          parseTime,
        });
        throw error;
      }
      
      // Get document metadata
      const metadata = await pdfDocument.getMetadata();
      const title = (metadata?.info as any)?.Title || null;
      
      const extractionTime = Date.now() - startTime;
      console.log(`[INFO] PDF extraction successful: ${fullText.length} characters from ${numPages} pages in ${extractionTime}ms`);
      
      return {
        text: fullText.trim(),
        metadata: {
          pages: numPages,
          title: title || undefined,
        },
      };
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      logError('PDF extraction with pdfjs-dist failed', parseError, {
        fileInfo,
        method: 'pdfjs-dist',
        errorMessage,
      });
      
      // Check for specific error types and provide helpful messages
      if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted') || errorMessage.includes('malformed') || errorMessage.includes('Invalid PDF structure')) {
        throw new Error('The PDF file appears to be corrupted or invalid. Please try a different file.');
      }
      
      if (errorMessage.includes('encrypted') || errorMessage.includes('password') || errorMessage.includes('password required')) {
        throw new Error('The PDF file is encrypted or password-protected. Please remove the password and try again.');
      }
      
      if (errorMessage.includes('No text extracted') || errorMessage.includes('image-based') || errorMessage.includes('No text content')) {
        throw new Error('No text could be extracted from the PDF. The document may be image-based (scanned). Please use OCR or convert to text format.');
      }
      
      // Fallback: Try pdf-parse as backup if pdfjs-dist fails
      console.log('[INFO] Attempting fallback to pdf-parse...');
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(Buffer.from(buffer), { max: 0 });
        
        if (data.text && data.text.trim()) {
          console.log('[INFO] Fallback pdf-parse succeeded');
          return {
            text: data.text.trim(),
            metadata: {
              pages: data.numpages,
              title: data.info?.Title,
            },
          };
        }
      } catch (fallbackError) {
        console.log('[INFO] Fallback pdf-parse also failed');
        // Continue to throw original error
      }
      
      throw new Error(`Failed to parse PDF: ${errorMessage}. Please try converting the PDF to text format or use a Word document instead.`);
    }
  }

  // Handle Word documents (.docx)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    console.log(`[INFO] Processing Word document: ${file.name}`);
    try {
      const extractStartTime = Date.now();
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      const extractTime = Date.now() - extractStartTime;
      
      if (!result.value || !result.value.trim()) {
        const error = new Error('No text extracted from Word document');
        logError('Word document extraction returned empty', error, { fileInfo, extractTime });
        throw error;
      }
      
      console.log(`[INFO] Word document extraction successful: ${result.value.length} characters in ${extractTime}ms`);
      
      return {
        text: result.value,
      };
    } catch (error) {
      logError('Word document extraction failed', error, { fileInfo });
      throw error;
    }
  }

  // Handle plain text
  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    console.log(`[INFO] Processing text file: ${file.name}`);
    try {
      const text = Buffer.from(buffer).toString('utf-8');
      
      if (!text.trim()) {
        const error = new Error('Text file is empty');
        logError('Text file extraction returned empty', error, { fileInfo });
        throw error;
      }
      
      console.log(`[INFO] Text file processed: ${text.length} characters`);
      return { text };
    } catch (error) {
      logError('Text file processing failed', error, { fileInfo });
      throw error;
    }
  }

  const error = new Error(`Unsupported file type: ${fileType}. Please upload PDF, Word (.docx), or text files.`);
  logError('Unsupported file type', error, { fileInfo, fileType, fileName });
  throw error;
}

