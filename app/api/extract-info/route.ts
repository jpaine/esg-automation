import { NextRequest, NextResponse } from 'next/server';
import { callLLMJSON } from '@/lib/llm-client';
import { CompanyInfo } from '@/lib/types';

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
  const requestId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[API INFO] Extract info request started: ${requestId}`);
  
  // Validate environment variables
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    const error = new Error('API key not configured');
    logAPIError('Missing API key in extract request', error, { requestId });
    return NextResponse.json(
      { 
        error: 'API key not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.',
        requestId,
      },
      { status: 500 }
    );
  }
  
  try {
    const { text } = await request.json();

    if (!text) {
      const error = new Error('No text provided in request body');
      logAPIError('Missing text in extract request', error, { requestId });
      return NextResponse.json(
        { 
          error: 'No text provided',
          requestId,
        },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      const error = new Error('Text is empty after trimming');
      logAPIError('Empty text in extract request', error, { 
        requestId,
        textLength: text.length,
      });
      return NextResponse.json(
        { 
          error: 'Text is empty after trimming',
          requestId,
        },
        { status: 400 }
      );
    }

    const textInfo = {
      length: text.length,
      preview: text.substring(0, 500),
      truncated: text.length > 15000,
    };
    
    console.log(`[API INFO] Extracting company info from text: ${requestId}`, textInfo);

    const textToAnalyze = text.substring(0, 20000); // Increased limit for more context
    const prompt = `
You are an expert at extracting company information from business documents. Analyze the following text COMPLETELY and extract ALL relevant company details. You must be thorough and extract every piece of available information.

Text to analyze:
${textToAnalyze}

REQUIRED: Extract and return a JSON object with this EXACT structure. You MUST extract REAL information from the text - do NOT return empty strings, "Not specified", or placeholder values unless the text absolutely contains NO information about that field. Be extremely thorough:

{
  "companyName": "Full company name (e.g., 'FDcare' or 'Helicare') - REQUIRED: Must extract from text",
  "sector": "Primary sector (e.g., 'Healthcare', 'FinTech', 'EduTech', 'ClimateTech') - REQUIRED: Must extract from text",
  "subSector": "Specific sub-sector or area (e.g., 'Primary Care and Homecare Services', 'Digital Payments') - REQUIRED: Must extract from text",
  "countriesOfOperation": ["Country 1", "Country 2"] - REQUIRED: Must extract at least one country from text,
  "numberOfEmployees": "Number or range (e.g., '<30', '50-100', '100-200', 'approximately 50') - REQUIRED: Must extract from text",
  "businessActivities": "Detailed description of what the company does, its business model, and operations - REQUIRED: Must be detailed and extracted from text",
  "productDescription": "Description of the main product or service offering, including target customers and value proposition - REQUIRED: Must be detailed and extracted from text",
  "currentESGPractices": "Any ESG practices, policies, or initiatives mentioned (use empty string if none found)",
  "policies": "Any company policies mentioned (use empty string if none found)",
  "complianceStatus": "Compliance status or regulatory information if mentioned (use empty string if none found)"
}

CRITICAL EXTRACTION RULES - READ CAREFULLY:

1. COMPANY NAME (REQUIRED):
   - Search the ENTIRE text for company name
   - Look in: headers, titles, first paragraph, "About [Company]", "[Company] is", "[Company] Inc.", "[Company] Pte Ltd"
   - Extract the FULL official name, not abbreviations
   - If multiple names appear, use the most official/full version
   - DO NOT return empty string - this is CRITICAL

2. SECTOR (REQUIRED):
   - Identify from business descriptions, keywords: healthcare/health/medical, fintech/finance/financial, education/edtech, climate/energy/environment, technology/tech, etc.
   - Look for phrases: "X is a [sector] company", "operating in [sector]", "sector: [sector]"
   - If text says "healthcare startup" → sector is "Healthcare"
   - If text says "fintech platform" → sector is "FinTech"
   - DO NOT return empty string - infer from context if needed

3. SUB-SECTOR (REQUIRED):
   - Be specific: "Primary Care and Homecare Services", "Digital Payments", "Online Education Platform"
   - Look for detailed descriptions of what the company does
   - Extract the specific niche or area within the sector
   - DO NOT return empty string - be specific based on text

4. COUNTRIES OF OPERATION (REQUIRED - at least one):
   - Search for: "operates in", "based in", "headquartered in", "presence in", "markets:", "countries:", "serving [country]"
   - Extract ALL countries mentioned
   - If only one country mentioned, still use array: ["Vietnam"]
   - If text says "Singapore-based" → ["Singapore"]
   - If text says "operates in Vietnam and Singapore" → ["Vietnam", "Singapore"]
   - DO NOT return empty array - extract at least one country

5. NUMBER OF EMPLOYEES (REQUIRED):
   - Search for: "number of employees", "team size", "workforce", "staff", "employees", "team of X", "X people", "X employees"
   - Extract exact number or range
   - If approximate: "approximately 50" or "~50" or "around 50 employees"
   - If range: "50-100", "between 50 and 100"
   - If small: "<30", "under 30", "less than 30"
   - DO NOT return empty string - search thoroughly

6. BUSINESS ACTIVITIES (REQUIRED - must be detailed):
   - Extract COMPLETE description of what company does
   - Look for: "The company", "We", "Our business", "Company X provides", "offers", "operates"
   - Include: business model, operations, how they make money, what they do
   - Must be at least 2-3 sentences with real details
   - DO NOT return generic phrases - extract specific details from text

7. PRODUCT DESCRIPTION (REQUIRED - must be detailed):
   - Extract what they sell/offer
   - Include: target customers, value proposition, key features
   - Look for: "product", "service", "offering", "solution", "platform"
   - Must be at least 2-3 sentences with real details
   - DO NOT return generic phrases - extract specific details from text

8. OPTIONAL FIELDS (can be empty string if not found):
   - currentESGPractices: Only if ESG is mentioned
   - policies: Only if policies are mentioned
   - complianceStatus: Only if compliance is mentioned

VALIDATION CHECKLIST - Before returning JSON, verify:
✓ companyName is NOT empty and is a real company name from the text
✓ sector is NOT empty and matches the business described
✓ subSector is NOT empty and is specific
✓ countriesOfOperation has at least ONE country
✓ numberOfEmployees is NOT empty and contains a number or range
✓ businessActivities is NOT empty and has detailed description (at least 50 characters)
✓ productDescription is NOT empty and has detailed description (at least 50 characters)

If ANY required field is missing or empty, you MUST re-read the text and extract it. Do NOT return incomplete data.
`;

    console.log(`[API INFO] Calling LLM for extraction: ${requestId}`);
    
    try {
      // Use a more robust extraction approach with retry logic
      let companyInfo: CompanyInfo | null = null;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts && !companyInfo) {
        attempts++;
        console.log(`[API INFO] Extraction attempt ${attempts}/${maxAttempts}: ${requestId}`);
        
        try {
          companyInfo = await callLLMJSON<CompanyInfo>(
            prompt,
            `You are an expert at extracting structured information from company documents, pitch decks, financial reports, and business descriptions.

CRITICAL REQUIREMENTS - You MUST extract COMPLETE information:
1. ALL required fields MUST be populated with REAL data from the text
2. Required fields: companyName, sector, subSector, countriesOfOperation (at least 1), numberOfEmployees, businessActivities (detailed), productDescription (detailed)
3. Do NOT return empty strings, "Not specified", or placeholder values for required fields
4. Read the ENTIRE text carefully - information may be scattered throughout
5. Extract specific details, not generic descriptions
6. For businessActivities and productDescription, provide detailed descriptions (at least 50 characters each)
7. If you cannot find information after thorough search, you MUST indicate this clearly, but try your absolute best to extract everything
8. Return valid JSON with ALL fields present - use empty strings only for optional fields (currentESGPractices, policies, complianceStatus) if not found`,
            'openai'
          );
          
          // Validate the extracted data
          if (companyInfo) {
            const validationErrors: string[] = [];
            
            // Check required fields
            if (!companyInfo.companyName || companyInfo.companyName.trim().length === 0 || 
                companyInfo.companyName.toLowerCase() === 'not specified') {
              validationErrors.push('companyName is missing or empty');
            }
            
            if (!companyInfo.sector || companyInfo.sector.trim().length === 0 || 
                companyInfo.sector.toLowerCase() === 'not specified') {
              validationErrors.push('sector is missing or empty');
            }
            
            if (!companyInfo.subSector || companyInfo.subSector.trim().length === 0 || 
                companyInfo.subSector.toLowerCase() === 'not specified') {
              validationErrors.push('subSector is missing or empty');
            }
            
            if (!Array.isArray(companyInfo.countriesOfOperation) || companyInfo.countriesOfOperation.length === 0) {
              validationErrors.push('countriesOfOperation is missing or empty (need at least 1 country)');
            }
            
            if (!companyInfo.numberOfEmployees || companyInfo.numberOfEmployees.trim().length === 0 || 
                companyInfo.numberOfEmployees.toLowerCase() === 'not specified') {
              validationErrors.push('numberOfEmployees is missing or empty');
            }
            
            if (!companyInfo.businessActivities || companyInfo.businessActivities.trim().length < 50) {
              validationErrors.push(`businessActivities is missing or too short (need at least 50 characters, got ${companyInfo.businessActivities?.length || 0})`);
            }
            
            if (!companyInfo.productDescription || companyInfo.productDescription.trim().length < 50) {
              validationErrors.push(`productDescription is missing or too short (need at least 50 characters, got ${companyInfo.productDescription?.length || 0})`);
            }
            
            if (validationErrors.length > 0) {
              console.warn(`[API WARN] Validation failed on attempt ${attempts}: ${requestId}`, validationErrors);
              
              if (attempts < maxAttempts) {
                // Retry with more explicit instructions
                console.log(`[API INFO] Retrying extraction with enhanced prompt: ${requestId}`);
                companyInfo = null; // Reset to retry
                
                // Enhance prompt for retry
                const retryPrompt = `${prompt}

RETRY ATTEMPT - Previous extraction was incomplete. The following fields were missing or invalid:
${validationErrors.map(e => `- ${e}`).join('\n')}

You MUST extract ALL of these fields from the text. Read the text more carefully and extract every piece of information. Do NOT return empty values for required fields.`;
                
                companyInfo = await callLLMJSON<CompanyInfo>(
                  retryPrompt,
                  `You are an expert at extracting structured information. The previous extraction was incomplete. You MUST extract ALL required fields with real data from the text. Do NOT return empty strings for: companyName, sector, subSector, countriesOfOperation, numberOfEmployees, businessActivities, productDescription.`,
                  'openai'
                );
              } else {
                // Final attempt failed, throw error
                throw new Error(`Extraction incomplete after ${maxAttempts} attempts. Missing fields: ${validationErrors.join(', ')}`);
              }
            } else {
              console.log(`[API INFO] Validation passed on attempt ${attempts}: ${requestId}`);
              break; // Success, exit retry loop
            }
          }
        } catch (extractionError) {
          if (attempts >= maxAttempts) {
            throw extractionError; // Re-throw if final attempt
          }
          console.warn(`[API WARN] Extraction attempt ${attempts} failed, retrying: ${requestId}`, extractionError);
          companyInfo = null; // Reset for retry
        }
      }
      
      if (!companyInfo) {
        throw new Error('Failed to extract company information after all attempts');
      }

      const extractionTime = Date.now() - startTime;
      const extractedFields = Object.keys(companyInfo).filter(key => {
        const value = (companyInfo as any)[key];
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'string') return value.trim().length > 0;
        return !!value;
      });
      
      console.log(`[API INFO] LLM extraction completed: ${requestId}`, {
        extractionTime: `${extractionTime}ms`,
        extractedFields: extractedFields.length,
        fields: extractedFields,
        companyInfo: JSON.stringify(companyInfo, null, 2),
      });

      // Final validation - all required fields must be present and valid
      const finalValidationErrors: string[] = [];
      
      if (!companyInfo.companyName || companyInfo.companyName.trim().length === 0) {
        finalValidationErrors.push('companyName is required');
      }
      if (!companyInfo.sector || companyInfo.sector.trim().length === 0) {
        finalValidationErrors.push('sector is required');
      }
      if (!companyInfo.subSector || companyInfo.subSector.trim().length === 0) {
        finalValidationErrors.push('subSector is required');
      }
      if (!Array.isArray(companyInfo.countriesOfOperation) || companyInfo.countriesOfOperation.length === 0) {
        finalValidationErrors.push('countriesOfOperation must have at least one country');
      }
      if (!companyInfo.numberOfEmployees || companyInfo.numberOfEmployees.trim().length === 0) {
        finalValidationErrors.push('numberOfEmployees is required');
      }
      if (!companyInfo.businessActivities || companyInfo.businessActivities.trim().length < 50) {
        finalValidationErrors.push('businessActivities must be at least 50 characters');
      }
      if (!companyInfo.productDescription || companyInfo.productDescription.trim().length < 50) {
        finalValidationErrors.push('productDescription must be at least 50 characters');
      }
      
      if (finalValidationErrors.length > 0) {
        const error = new Error(`Extraction incomplete: ${finalValidationErrors.join(', ')}`);
        logAPIError('Incomplete extraction result', error, {
          requestId,
          textInfo,
          extractionTime,
          extractedFields,
          companyInfo,
          finalValidationErrors,
        });
        
        return NextResponse.json(
          { 
            error: `Could not extract complete company information. Missing or incomplete: ${finalValidationErrors.join(', ')}. Please ensure the document contains clear company details and try again.`,
            debug: {
              textLength: text.length,
              textPreview: text.substring(0, 500),
              extractedFields,
              validationErrors: finalValidationErrors,
            },
            requestId,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        ...companyInfo,
        requestId,
      });
    } catch (llmError) {
      const extractionTime = Date.now() - startTime;
      logAPIError('LLM extraction failed', llmError, {
        requestId,
        textInfo,
        extractionTime,
      });
      
      const errorMessage = llmError instanceof Error ? llmError.message : 'Failed to extract information';
      return NextResponse.json(
        { 
          error: errorMessage,
          requestId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logAPIError('Extract info request failed', error, {
      requestId,
      processingTime,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract information';
    return NextResponse.json(
      { 
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}

