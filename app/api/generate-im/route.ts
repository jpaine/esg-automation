import { NextRequest, NextResponse } from 'next/server';
import { generateIM } from '@/lib/im-generator';
import { CompanyInfo, DDQResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  // Validate environment variables
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { 
        error: 'API key not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.',
      },
      { status: 500 }
    );
  }

  try {
    const { companyInfo, ddqResult, extractedText } = await request.json();

    if (!companyInfo || !ddqResult) {
      return NextResponse.json(
        { error: 'Company information and DDQ results are required' },
        { status: 400 }
      );
    }

    const imResult = await generateIM(
      companyInfo as CompanyInfo,
      ddqResult as DDQResult,
      extractedText
    );

    return NextResponse.json(imResult);
  } catch (error) {
    console.error('IM generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate IM' },
      { status: 500 }
    );
  }
}

