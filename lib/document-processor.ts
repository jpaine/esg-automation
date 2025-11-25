import mammoth from 'mammoth';

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
    
    // Use pdf-parse directly (more reliable in Node.js/Next.js serverless environments)
    // pdfjs-dist has compatibility issues in serverless environments
    try {
      console.log('[INFO] Starting PDF extraction with pdf-parse...');
      const pdfParse = require('pdf-parse');
      const parseStartTime = Date.now();
      
      // Parse PDF with options
      const data = await pdfParse(Buffer.from(buffer), { 
        max: 0, // Parse all pages
      });
      const parseTime = Date.now() - parseStartTime;
      
      console.log(`[INFO] pdf-parse extraction completed in ${parseTime}ms`, {
        pages: data.numpages,
        textLength: data.text?.length || 0,
        hasText: !!data.text && data.text.trim().length > 0,
      });
      
      if (!data.text || !data.text.trim()) {
        const error = new Error('No text extracted from PDF - document may be image-based, encrypted, or empty');
        logError('pdf-parse returned empty text', error, {
          fileInfo,
          numPages: data.numpages,
          parseTime,
          hasMetadata: !!data.info,
        });
        throw error;
      }
      
      const extractionTime = Date.now() - startTime;
      console.log(`[INFO] PDF extraction successful: ${data.text.length} characters from ${data.numpages} pages in ${extractionTime}ms`);
      
      return {
        text: data.text.trim(),
        metadata: {
          pages: data.numpages,
          title: data.info?.Title,
        },
      };
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      logError('PDF extraction with pdf-parse failed', parseError, {
        fileInfo,
        method: 'pdf-parse',
        errorMessage,
      });
      
      // Check for specific error types and provide helpful messages
      if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted') || errorMessage.includes('malformed')) {
        throw new Error('The PDF file appears to be corrupted or invalid. Please try a different file.');
      }
      
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        throw new Error('The PDF file is encrypted or password-protected. Please remove the password and try again.');
      }
      
      if (errorMessage.includes('No text extracted') || errorMessage.includes('image-based')) {
        throw new Error('No text could be extracted from the PDF. The document may be image-based (scanned). Please use OCR or convert to text format.');
      }
      
      if (errorMessage.includes('worker') || errorMessage.includes('pdf.worker') || errorMessage.includes('Cannot find module')) {
        throw new Error('PDF parsing configuration issue. Please try converting the PDF to text format or use a Word document instead.');
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

