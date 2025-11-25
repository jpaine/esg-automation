import { NextRequest, NextResponse } from 'next/server';
import { generateDDQ } from '@/lib/ddq-generator';
import { CompanyInfo } from '@/lib/types';

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
    const { companyInfo, extractedText } = await request.json();

    if (!companyInfo) {
      return NextResponse.json(
        { error: 'Company information is required' },
        { status: 400 }
      );
    }

    const ddqResult = await generateDDQ(companyInfo as CompanyInfo, extractedText);

    return NextResponse.json(ddqResult);
  } catch (error) {
    console.error('DDQ generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate DDQ' },
      { status: 500 }
    );
  }
}

