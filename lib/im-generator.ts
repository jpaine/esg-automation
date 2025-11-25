import { callLLMJSON } from './llm-client';
import { loadRMF } from './rmf-loader';
import { CompanyInfo, DDQResult, IMResult } from './types';

/**
 * Generate Investment Memo based on DDQ results and company information
 */
export async function generateIM(
  companyInfo: CompanyInfo,
  ddqResult: DDQResult,
  extractedText?: string
): Promise<IMResult> {
  const rmf = await loadRMF();

  const companyContext = `
Company Information:
- Name: ${companyInfo.companyName}
- Sector: ${companyInfo.sector}
- Sub-sector: ${companyInfo.subSector}
- Countries of Operation: ${companyInfo.countriesOfOperation.join(', ')}
- Number of Employees: ${companyInfo.numberOfEmployees}
- Business Activities: ${companyInfo.businessActivities}
- Product/Service: ${companyInfo.productDescription}
${extractedText ? `\nAdditional Information from Documents:\n${extractedText.substring(0, 5000)}` : ''}
`;

  const ddqSummary = `
DDQ Assessment Summary:
${JSON.stringify(ddqResult, null, 2)}
`;

  const prompt = `
You are an ESG investment analyst. Using the ESG Risk Management Framework and the DDQ assessment results, create an Investment Memo following the EXACT template structure from the Helicare example.

${companyContext}

${ddqSummary}

ESG Risk Management Framework:
${rmf}

CRITICAL: Follow the EXACT format from the Helicare_ESG_IM template:

1. Company Name: [name]
2. Product/ Activity/ Solution: [detailed description]
3. Findings from the ESG Due Diligence
   - Risk Category (Category C/B+/B): [category]
   - Accessibility of grievance redress mechanism (include website link): [description with link if available, or "Currently non-existent" if not]
   - Sector & sub-sector: [sector] - [sub-sector]
   - Countries of operation: [comma-separated list]
   - No. of Employees: [number or range - use the exact value from company information. If the value is provided, use it. Do not say 'Not specified' unless truly unavailable]
   - Current risks and opportunities
     * Current Risks: [detailed bullet points with explanations]
     * Current Opportunities: [detailed bullet points with explanations]
   - Long-term risks and opportunities
     * Long term risks: [detailed bullet points with explanations]
     * Long term opportunities: [detailed bullet points with explanations]
   - Founders' commitment to and company capacity on ESG risk management: [detailed assessment]
   - Highlights of the relevant stakeholder consultations conducted, potential grievances, and risk of retaliation that could emerge and commitment to a stakeholder engagement plan.
     * Stakeholder Consultations: [detailed description]
     * Potential Grievances: [detailed description]
     * Risk of Retaliation: [detailed assessment]
   - Gaps in the fund's ESG requirements and proposed action plan to address gaps
     * Gaps: [detailed bullet points]
     * Action Plan: [detailed bullet points with specific actions]
   - Estimated cost of corrective actions and timeframe: [cost and timeframe, or "Not available" if not specified]
   - Limitation of ESG due diligence: [numbered list of limitations]

RISK CATEGORY GUIDELINES (from framework):
- Category C: Minimal or no adverse ESG impacts. Minimal impacts can be mitigated with well-known, cost-effective measures.
- Category B: Limited number of potentially adverse ESG impacts. Impacts are not unprecedented, few if any are irreversible or cumulative, can be managed using good practice.
- Category B+: Limited number of potentially adverse ESG impacts but may pose higher risk. Can be managed with external support.
- Category A: Significant adverse ESG impacts that are irreversible, cumulative, diverse, or unprecedented. EXCLUDED from investment.

For current/long-term risks and opportunities:
- Be specific and detailed (like Helicare example)
- For each risk/opportunity, provide detailed multi-bullet explanations like the Helicare example:
  Format: * [Main Risk/Opportunity Title]
    * [Detailed explanation bullet 1]
    * [Detailed explanation bullet 2]
    * [Additional context or implications]
- Reference specific DDQ findings (e.g., "As identified in the DDQ, the company lacks formal ESG reporting...")
- Include specific examples from company operations (e.g., "Multi-country operations across 10 countries require...")
- Include explanations and context
- Reference specific ESG areas from DDQ
- For opportunities, mention how they mitigate risks or create value

For gaps and action plan:
- Be specific about what's missing
- Action plan items must be specific and actionable, matching Helicare detail level:
  Format: * [Specific action] - [Who is responsible] - [Expected deliverable] - [Timeline if relevant]
  Example: "Develop and Implement a Formal ESG Policy commensurate to [company]'s business stage, which is currently relatively early (<2 years of operations)."
- Action plan items should be actionable and specific
- Reference the DDQ areas that need improvement

Return a JSON object with this exact structure:
{
  "companyName": "${companyInfo.companyName}",
  "productActivitySolution": "Detailed description matching Helicare format",
  "riskCategory": "Category C" | "Category B" | "Category B+" | "Category A",
  "grievanceRedressMechanism": "Description and website link if available, or 'Currently non-existent' if not",
  "sector": "${companyInfo.sector}",
  "subSector": "${companyInfo.subSector}",
  "countriesOfOperation": "${companyInfo.countriesOfOperation.join(', ')}",
  "numberOfEmployees": "${companyInfo.numberOfEmployees || 'Not specified'}",
  "currentRisks": ["Detailed risk 1 with explanation", "Detailed risk 2 with explanation", ...],
  "currentOpportunities": ["Detailed opportunity 1 with explanation", "Detailed opportunity 2 with explanation", ...],
  "longTermRisks": ["Detailed long-term risk 1 with explanation", ...],
  "longTermOpportunities": ["Detailed long-term opportunity 1 with explanation", ...],
  "foundersCommitment": "Detailed assessment matching Helicare format",
  "stakeholderConsultations": "Detailed description matching Helicare format",
  "potentialGrievances": "Detailed description matching Helicare format",
  "riskOfRetaliation": "Detailed assessment matching Helicare format",
  "gaps": ["Detailed gap 1", "Detailed gap 2", ...],
  "actionPlan": ["Detailed action item 1", "Detailed action item 2", ...],
  "estimatedCost": "Estimated cost if available, or 'Not available'",
  "timeframe": "Timeframe for corrective actions",
  "limitations": ["Limitation 1", "Limitation 2", ...]
}

Be comprehensive, detailed, and match the Helicare example format exactly. Reference specific DDQ findings in your responses.

LIMITATIONS SECTION:
- Provide 2-3 comprehensive limitations covering: data availability, assessment scope, company stage, and any other relevant constraints
- Each limitation should be detailed and specific
- Format as numbered list (1., 2., 3.)
- Examples: "The current ESG due diligence relies heavily on self-reported data and informal, ad hoc processes, which may not capture all risks or operational nuances."
`;

  const result = await callLLMJSON<IMResult>(prompt,
    'You are an expert ESG investment analyst. Create detailed investment memos based on ESG assessments and the Golden Gate Ventures framework.',
    'openai'
  );

  return result;
}

