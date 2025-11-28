import mammoth from 'mammoth';
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
 * Extract text from PDF using Gemini API
 * Works for both text-based and image-based (scanned) PDFs
 */
async function extractTextWithGemini(buffer: ArrayBuffer, fileName: string): Promise<ExtractedText> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Cannot use Gemini API for PDF extraction.');
  }

  console.log('[INFO] Starting PDF extraction with Gemini API...');
  const startTime = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash for multimodal support (PDFs) - faster and more cost-effective
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Convert ArrayBuffer to base64 for Gemini API
    const base64Pdf = Buffer.from(buffer).toString('base64');

    // Optimize prompt for faster processing
    const prompt = `Extract all text from this PDF document. Return only the extracted text content, preserving structure. Include headings, paragraphs, lists, and tables.`;

    // Add timeout wrapper for the API call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API call timed out after 4 minutes')), 240000); // 4 minutes
    });

    const result = await Promise.race([
      model.generateContent([
        {
          inlineData: {
            data: base64Pdf,
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ]),
      timeoutPromise,
    ]) as Awaited<ReturnType<typeof model.generateContent>>;

    // Get text from response - ensure we only read it once
    let text: string;
    try {
      text = result.response.text();
    } catch (textError) {
      // If text() fails, try accessing candidates directly
      const candidates = result.response.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content) {
        const parts = candidates[0].content.parts;
        text = parts.map((part: any) => part.text || '').join('');
      } else {
        throw new Error('Failed to extract text from Gemini response');
      }
    }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logError('Gemini API extraction failed', error, {
      fileName,
      extractionTime,
      errorMessage,
    });
    
    // Provide helpful error messages
    if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      throw new Error('Gemini API authentication failed. Please check your GEMINI_API_KEY environment variable.');
    }
    
    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted') || errorMessage.includes('malformed')) {
      throw new Error('The PDF file appears to be corrupted or invalid. Please try a different file.');
    }
    
    if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
      throw new Error('The PDF file is encrypted or password-protected. Please remove the password and try again.');
    }
    
    if (errorMessage.includes('size') || errorMessage.includes('too large')) {
      throw new Error('The PDF file is too large. Please try a smaller file or split it into multiple files.');
    }
    
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      throw new Error('PDF processing timed out. The file may be too large or complex. Please try a smaller file or split it into multiple files.');
    }
    
    throw new Error(`Failed to extract text from PDF: ${errorMessage}. Please try converting the PDF to text format or use a Word document instead.`);
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

  // Handle PDF files - use Gemini API only
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    console.log(`[INFO] Processing PDF file: ${file.name}`);
    return await extractTextWithGemini(buffer, file.name);
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
