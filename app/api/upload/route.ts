import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile } from '@/lib/document-processor';

/**
 * Enhanced error logging for API routes
 */
function logAPIError(context: string, error: unknown, requestInfo?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    context,
    error: error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : { message: String(error) },
    ...requestInfo,
  };
  
  console.error(`[API ERROR ${timestamp}] ${context}:`, JSON.stringify(errorDetails, null, 2));
  return errorDetails;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[API INFO] Upload request started: ${requestId}`);
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      const error = new Error('No file provided in request');
      logAPIError('Missing file in upload request', error, { requestId });
      return NextResponse.json(
        { 
          error: 'No file provided',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file size (Vercel has 4.5MB limit for request body)
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const error = new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of 4.5MB`);
      logAPIError('File size validation failed', error, { 
        requestId,
        fileName: file.name,
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE,
      });
      return NextResponse.json(
        { 
          error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 4.5MB. Please upload a smaller file.`,
          requestId,
        },
        { status: 413 }
      );
    }

    const fileInfo = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    };
    
    console.log(`[API INFO] Processing file upload: ${requestId}`, fileInfo);

    try {
      const extracted = await extractTextFromFile(file);
      const processingTime = Date.now() - startTime;
      
      console.log(`[API INFO] File extraction completed: ${requestId}`, {
        ...fileInfo,
        extractedTextLength: extracted.text?.length || 0,
        metadata: extracted.metadata,
        processingTime: `${processingTime}ms`,
      });
      
      if (extracted.text) {
        console.log(`[API INFO] Extracted text preview (first 500 chars): ${extracted.text.substring(0, 500)}`);
      }

      if (!extracted.text || extracted.text.trim().length === 0) {
        const error = new Error('No text extracted from file');
        logAPIError('Empty extraction result', error, {
          requestId,
          fileInfo,
          metadata: extracted.metadata,
          processingTime,
        });
        
        return NextResponse.json(
          { 
            error: 'No text could be extracted from the file. The file may be empty, corrupted, or in an unsupported format.',
            text: '',
            metadata: extracted.metadata,
            fileName: file.name,
            requestId,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        text: extracted.text,
        metadata: extracted.metadata,
        fileName: file.name,
        requestId,
      });
    } catch (extractionError) {
      const processingTime = Date.now() - startTime;
      logAPIError('File extraction failed', extractionError, {
        requestId,
        fileInfo,
        processingTime,
      });
      
      const errorMessage = extractionError instanceof Error ? extractionError.message : 'Failed to process file';
      return NextResponse.json(
        { 
          error: errorMessage,
          requestId,
          fileName: file.name,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logAPIError('Upload request failed', error, {
      requestId,
      processingTime,
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process file',
        requestId,
      },
      { status: 500 }
    );
  }
}

