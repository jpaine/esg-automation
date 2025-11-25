import { NextRequest, NextResponse } from 'next/server';
import { generateIMDocument } from '@/lib/document-generator';
import { IMResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { imResult } = await request.json();

    if (!imResult) {
      return NextResponse.json(
        { error: 'IM result is required' },
        { status: 400 }
      );
    }

    const buffer = await generateIMDocument(imResult as IMResult);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="ESG_Investment_Memo.docx"',
      },
    });
  } catch (error) {
    console.error('Document generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate document' },
      { status: 500 }
    );
  }
}

