import mammoth from 'mammoth';
// pdf-parse uses CommonJS, so we need to use require() or dynamic import
import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * Extract text from PDF using Gemini API (for OCR/image-based PDFs)
 */
async function extractTextWithGemini(buffer: ArrayBuffer, fileName: string): Promise<ExtractedText> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Cannot use Gemini API for OCR.');
  }

  console.log('[INFO] Attempting PDF extraction with Gemini API (OCR)...');
  const startTime = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Convert ArrayBuffer to base64 for Gemini API
    const base64Pdf = Buffer.from(buffer).toString('base64');

    const prompt = `Extract all text from this PDF document. Return only the extracted text content, preserving the structure and formatting as much as possible. Include all headings, paragraphs, lists, tables, and any other text content.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Pdf,
          mimeType: 'application/pdf',
        },
      },
      prompt,
    ]);

    const response = result.response;
    const text = response.text();

    if (!text || !text.trim()) {
      throw new Error('Gemini API returned empty text');
    }

    const extractionTime = Date.now() - startTime;
    console.log(`[INFO] Gemini API extraction successful: ${text.length} characters in ${extractionTime}ms`);

    return {
      text: text.trim(),
      metadata: {
        title: fileName,
      },
    };
  } catch (error) {
    const extractionTime = Date.now() - startTime;
    logError('Gemini API extraction failed', error, {
      fileName,
      extractionTime,
    });
    throw error;
  }
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
    
    // Primary method: pdf-parse (works well in serverless, no workers needed)
    try {
      console.log('[INFO] Starting PDF extraction with pdf-parse...');
      const parseStartTime = Date.now();
      
      // Use dynamic require for pdf-parse (CommonJS module)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(Buffer.from(buffer), { max: 0 });
      
      const parseTime = Date.now() - parseStartTime;
      
      console.log(`[INFO] pdf-parse extraction completed in ${parseTime}ms`, {
        pages: data.numpages,
        textLength: data.text?.length || 0,
        hasText: !!(data.text && data.text.trim()),
      });
      
      // Check if we got meaningful text
      if (data.text && data.text.trim().length > 50) {
        // Good extraction - return it
        const extractionTime = Date.now() - startTime;
        console.log(`[INFO] PDF extraction successful: ${data.text.length} characters from ${data.numpages} pages in ${extractionTime}ms`);
        
        return {
          text: data.text.trim(),
          metadata: {
            pages: data.numpages,
            title: data.info?.Title,
          },
        };
      } else if (data.text && data.text.trim().length > 0) {
        // Very little text extracted - might be image-based, but return what we have
        console.log('[INFO] pdf-parse extracted minimal text - document may be image-based');
        return {
          text: data.text.trim(),
          metadata: {
            pages: data.numpages,
            title: data.info?.Title,
          },
        };
      } else {
        // No text extracted - likely image-based PDF, try Gemini OCR
        throw new Error('No text extracted - document may be image-based');
      }
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      logError('PDF extraction with pdf-parse failed', parseError, {
        fileInfo,
        method: 'pdf-parse',
        errorMessage,
      });
      
      // Check for specific error types
      if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted') || errorMessage.includes('malformed')) {
        throw new Error('The PDF file appears to be corrupted or invalid. Please try a different file.');
      }
      
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        throw new Error('The PDF file is encrypted or password-protected. Please remove the password and try again.');
      }
      
      // Fallback: Try Gemini API for OCR (image-based PDFs)
      if (errorMessage.includes('No text extracted') || errorMessage.includes('image-based') || errorMessage.includes('minimal text')) {
        console.log('[INFO] PDF appears to be image-based, attempting OCR with Gemini API...');
        try {
          return await extractTextWithGemini(buffer, file.name);
        } catch (geminiError) {
          const geminiErrorMessage = geminiError instanceof Error ? geminiError.message : 'Unknown error';
          logError('Gemini API fallback failed', geminiError, {
            fileInfo,
            originalError: errorMessage,
          });
          
          // If Gemini also fails, provide helpful error
          throw new Error(`Failed to extract text from PDF. The document may be image-based (scanned). Gemini OCR also failed: ${geminiErrorMessage}. Please try converting the PDF to text format or use a Word document instead.`);
        }
      }
      
      // For other errors, try Gemini as last resort
      console.log('[INFO] Attempting Gemini API as final fallback...');
      try {
        return await extractTextWithGemini(buffer, file.name);
      } catch (geminiError) {
        logError('Gemini API final fallback failed', geminiError, {
          fileInfo,
          originalError: errorMessage,
        });
        
        throw new Error(`Failed to parse PDF: ${errorMessage}. Please try converting the PDF to text format or use a Word document instead.`);
      }
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
