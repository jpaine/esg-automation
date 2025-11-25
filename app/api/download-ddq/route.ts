import { NextRequest, NextResponse } from 'next/server';
import { generateDDQDocument } from '@/lib/document-generator';
import { DDQResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { ddqResult } = await request.json();

    if (!ddqResult) {
      return NextResponse.json(
        { error: 'DDQ result is required' },
        { status: 400 }
      );
    }

    const buffer = await generateDDQDocument(ddqResult as DDQResult);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="ESG_DDQ.docx"',
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

