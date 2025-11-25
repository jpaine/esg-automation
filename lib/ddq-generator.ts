import { callLLMJSON } from './llm-client';
import { loadRMF } from './rmf-loader';
import { CompanyInfo, DDQResult } from './types';
import { searchTrackRecord, searchESGPractices, formatSearchResultsForPrompt } from './web-search';

/**
 * Generate DDQ assessment based on company information and RMF
 */
export async function generateDDQ(
  companyInfo: CompanyInfo,
  extractedText?: string
): Promise<DDQResult> {
  const rmf = await loadRMF();
  
  console.log(`[DDQ GENERATOR] Starting DDQ generation for: ${companyInfo.companyName}`);
  
  // Perform web searches for additional information
  console.log(`[DDQ GENERATOR] Performing web searches...`);
  const [trackRecordResults, esgPracticeResults] = await Promise.all([
    searchTrackRecord(companyInfo.companyName).catch(err => {
      console.error('[DDQ GENERATOR] Track record search failed:', err);
      return [];
    }),
    searchESGPractices(companyInfo.companyName).catch(err => {
      console.error('[DDQ GENERATOR] ESG practices search failed:', err);
      return [];
    }),
  ]);
  
  // Format search results for prompt
  const allSearchResults = [...trackRecordResults, ...esgPracticeResults];
  const searchResultsText = formatSearchResultsForPrompt(allSearchResults);
  
  console.log(`[DDQ GENERATOR] Web search completed. Found ${allSearchResults.reduce((sum, sr) => sum + sr.results.length, 0)} results`);

  const companyContext = `
Company Information:
- Name: ${companyInfo.companyName}
- Sector: ${companyInfo.sector}
- Sub-sector: ${companyInfo.subSector}
- Countries of Operation: ${companyInfo.countriesOfOperation.join(', ')}
- Number of Employees: ${companyInfo.numberOfEmployees}
- Business Activities: ${companyInfo.businessActivities}
- Product/Service: ${companyInfo.productDescription}
${companyInfo.currentESGPractices ? `- Current ESG Practices: ${companyInfo.currentESGPractices}` : ''}
${companyInfo.policies ? `- Policies: ${companyInfo.policies}` : ''}
${companyInfo.complianceStatus ? `- Compliance Status: ${companyInfo.complianceStatus}` : ''}
${extractedText ? `\nAdditional Information from Documents:\n${extractedText.substring(0, 5000)}` : ''}
${searchResultsText}
`;

  // Extract level definitions for key areas to include in prompt
  const levelDefinitions = `
CRITICAL LEVEL DEFINITIONS (read carefully before determining levels):

ESG Policy:
- Non-existent: No policy AND no ESG procedures at all
- Level 0: The company has no policy, but some ESG procedures in place (e.g., clearly documented employment contracts, transparent employment practices, responsible consumption of materials)

ESG Risk and Opportunity Identification:
- Non-existent: No identification or assessment of ESG risks
- Level 0: Basic identification and assessment of ESG risks but limited to a few activities

ESG Reporting:
- Non-existent: No ESG reporting at all
- Level 0: Minimal amounts of communication and ESG reporting are provided, usually or entirely initiated by the fund manager

ESG Performance Management & Monitoring:
- Non-existent: No programs or activities to manage and monitor ESG risks
- Level 0: Limited programs or activities to manage and monitor ESG risks

Environmental impact:
- Non-existent: No identification of environmental risks
- Level 0: The company identifies risk where its operations and value chain may pollute (e.g., pollute water, air, or land; increase waste generation; generate hazardous materials), use resources inefficiently, or threaten biodiversity. The company has and complies with any and all required environmental permits or licenses as per national law

Greenhouse gas emissions:
- Non-existent: No identification or tracking of GHG emissions
- Level 0: The company has identified the greenhouse gas emission intensity of its operations, and value chain to the extent possible

Labour Standards:
- Non-existent: No compliance with local labour laws or HR procedures
- Level 0: The company complies with local labour laws. The company intends to establish human resources policies and procedures and may have already implemented them informally

Occupational Health & Safety Standards:
- Non-existent: No OHS procedures
- Level 0: Procedures are implemented that identify and mitigate potential hazards to workers, particularly those that may be life-threatening. The company is compliant with all relevant OH&S laws and regulations

Child and Forced Labour Policy:
- Non-existent: No policy at all
- Level 0: The company has a basic policy in place to manage and establish the current or future risk of child and forced labour

Community Engagement and Impact:
- Non-existent: No stakeholder identification or engagement
- Level 0: The company identifies stakeholders that may be affected by its activities. It has procedures in place to identify and manage potential risks to community/stakeholder health and safety, and cultural heritage (where relevant)

Consumer Protection:
- Non-existent: No consumer protection measures
- Level 0: The company complies with relevant consumer protection laws

Supply chain risk management:
- Non-existent: No engagement with supply chain partners
- Level 0: The company engages with partners to be better informed of its supply chain and identify potential risks therein

Commitment to Corporate Governance (CG):
- Non-existent: No governance structure
- Level 0: There is a charter with basic corporate governance articles including wording on minority shareholder protection. Roles & responsibilities for the company are defined with clear decision-making and authority limits. Information is disclosed regularly

Board Structure and Functioning:
- Non-existent: No oversight or control processes
- Level 0: The company has informal oversight and control processes in place

Compliance with Laws & Regulations:
- Non-existent: No compliance mechanisms
- Level 0: Compliance with applicable legislation and regulations

Anti-Bribery and Corruption (ABC) Management:
- Non-existent: No anti-bribery processes
- Level 0: The company has anti-bribery and corruption processes in place and intends to establish a policy

AML, KYC & KYB Management:
- Non-existent: No AML/KYC/KYB checks
- Level 0: The company engages in ad-hoc Know Your Customer (KYC), Anti-Money Laundering (AML) and Know Your Business (KYB) checks. Incidents are reported to GGV

GRM & PPM:
- Non-existent: No grievance mechanism
- Level 0: The company operates a grievance mechanism to receive and facilitate resolution of the concerns and complaints of people who believe they have been affected by the company's business activities in respect to ESG matters. This is readily accessible in relevant languages on the company's website and also includes information about and a link to the AIIB'S Project Affected People's Mechanism website

Cyber Security and Data Governance:
- Non-existent: No security measures
- Level 0: Systems and security patches are up-to-date, and basic cyber threat and data security risk governance elements have been established

IMPORTANT: Before marking any area as "Non-existent", you MUST verify if Level 0 criteria are met. "Non-existent" means NO evidence of ANY practices, while "Level 0" means basic/minimal practices exist. When in doubt between Non-existent and Level 0, choose Level 0 if ANY basic procedures exist.
`;

  const prompt = `
You are an ESG assessment expert. Using the ESG Risk Management Framework provided below, assess the company and fill out the Due Diligence Questionnaire.

${companyContext}

${levelDefinitions}

ESG Risk Management Framework:
${rmf}

ASSESSMENT INSTRUCTIONS:

1. Use web search results (if provided) to verify information and fill gaps
2. For Track Record section, use web search results to verify if there are any reported:
   - Regulatory breaches or ESG-related non-compliances
   - Supply chain issues with respect to labor and working conditions
   - Transparency & disclosure issues (qualified audit opinions, financial restatements)
   - Renewable energy details (if applicable)
   
3. For each area, determine:
   - Materiality (High/Medium/Low/Non-existent) based on company's sector, operations, and scale. USE THESE GUIDELINES:
     * HIGH Materiality if:
       - Company operates in multiple countries (3+ countries = High)
       - Consumer-facing business (direct customer interaction, ticketing, events)
       - Environmental impact sector (events, manufacturing, energy, transportation)
       - Community-facing operations (events, venues, local partnerships)
       - Multi-country operations with varying regulatory environments (corruption risk)
       - Digital platform handling payments/data (cyber security, AML/KYC)
       - Operations affecting local communities (events, venues, tourism)
     * MEDIUM Materiality if:
       - Single-country or limited geographic scope
       - B2B operations with limited community impact
       - Low environmental footprint
     * LOW Materiality if:
       - Minimal operations, very small scale
       - No direct environmental or social impact
       - Not applicable to business model
   - Level (Level 0, Level 1, Level 2, Level 3, or Non-existent) - CRITICAL: Check Level 0 criteria first before marking "Non-existent"
   - Comments explaining your assessment with specific evidence from company information OR web search results
   
4. In comments, cite sources with DIRECT QUOTES:
   - ALWAYS quote specific text from documents when available (e.g., "Memo states: '200+ venue options, 24+ promo/marketing, 18+ production partners'")
   - Reference exact numbers, facts, or statements from the company information
   - Use direct quotes with quotation marks for key evidence
   - Reference web search findings when used for verification
   - Be specific about what evidence supports your level determination
   - CRITICAL: NEVER use phrases like "it is reasonable to infer", "suggests", "it is assumed", "likely", "may indicate", "it is reasonable to infer" - these are FORBIDDEN
   - If no direct quote exists, state: "No explicit mention of [topic] in provided documents. However, [specific indirect evidence] indicates [conclusion]"
   - If evidence is indirect, state it clearly: "While not explicitly stated, the memo mentions [specific evidence] which indicates..."
   - DO NOT make unsupported claims (e.g., don't state employee count unless explicitly mentioned)
   
   EXAMPLES OF GOOD vs BAD COMMENTS:
   BAD: "It is reasonable to infer that the company has basic procedures in place"
   GOOD: "The memo states: '200+ venue options, 24+ promo/marketing, 18+ production partners', indicating engagement with supply chain partners"
   
   BAD: "Given the company's operations, it suggests compliance with local labor laws"
   GOOD: "No explicit mention of labor policies in provided documents. However, the company operates in 10 countries across Asia, which requires compliance with local labor laws in each jurisdiction, indicating Level 0 compliance"

5. SECTOR-SPECIFIC INDICATORS - Look for indirect evidence:
   
   SUPPLY CHAIN RISK MANAGEMENT:
   - Mentions of "partner network", "supply chain partners", "vendors", "suppliers", "venue partners", "production partners" = Level 0
   - Any engagement with external parties for operations = Level 0
   - M&A activity or partner relationships = supply chain engagement
   
   COMMUNITY ENGAGEMENT AND IMPACT:
   - Strategic partnerships, sponsorships, venue partnerships = stakeholder identification
   - Tourism board partnerships, government relationships = community engagement
   - Brand partnerships, corporate sponsors = stakeholder engagement
   - Any mention of partnerships with external organizations = Level 0
   
   BOARD STRUCTURE AND FUNCTIONING:
   - Investment rounds with external investors = oversight structures exist
   - Mentions of "board", "investors", "governance", "oversight" = Level 0
   - Ownership structure with external parties = governance mechanisms
   - Quarterly reporting, investor updates = oversight processes
   
   GOVERNANCE (General):
   - Investment structure with seed/venture investors = governance framework
   - Legal counsel, compliance mentions = governance attention
   - Multi-country operations = governance structures required for compliance
   
   AML, KYC & KYB MANAGEMENT:
   - If company is developing/operating a digital platform handling payments, transactions, or user data = Level 0
   - If company has future plans for ticketing/data platforms = Level 0
   - If company handles customer data or financial transactions (even via third-parties) = Level 0
   
   CYBER SECURITY AND DATA GOVERNANCE:
   - If company is developing/operating a digital platform, ticketing system, or data platform = Level 0
   - If company collects, stores, or processes user data = Level 0
   - If company operates any digital infrastructure = Level 0
   
   ESG PERFORMANCE MANAGEMENT & MONITORING:
   - If company manages partner network, multi-country operations, or coordinates external vendors = Level 0
   - If company has operational management systems for multi-country coordination = Level 0
   - Partner network management, multi-country operations coordination = limited programs = Level 0
   
6. EVIDENCE INTERPRETATION:
   - "No explicit mention" does NOT mean "Non-existent" - look for indirect evidence
   - If company operates in multiple countries, assume basic compliance (Level 0) unless evidence suggests otherwise
   - If company has external investors, assume basic governance (Level 0)
   - If company mentions partnerships, assume stakeholder engagement (Level 0)
   - When in doubt between Non-existent and Level 0, choose Level 0 if ANY indirect evidence exists
   
7. BORDERLINE LEVEL 0 ASSESSMENTS - Be conservative but accurate:
   - ESG Risk and Opportunity Identification: Level 0 requires "Basic identification and assessment of ESG risks but limited to a few activities"
     * If company operates in multiple countries with environmental/social impact, this suggests basic risk awareness = Level 0
     * If NO evidence of any risk consideration exists, use Non-existent
   
   - ESG Performance Management & Monitoring: Level 0 requires "Limited programs or activities to manage and monitor ESG risks"
     * If company has an extensive partner network and manages operations across multiple countries, this implies "Limited programs or activities to manage and monitor ESG risks" (Level 0) through operational management, even if not formally ESG-labeled
     * Partner network management, multi-country operations coordination = limited programs = Level 0
     * If NO evidence of any management activities, use Non-existent
     * Always explain this operational management in comments: "The company manages [X] partners across [Y] countries, which requires operational coordination and risk management, indicating limited programs for ESG risk management (Level 0)"
   
   - AML, KYC & KYB Management: Level 0 requires "The company engages in ad-hoc Know Your Customer (KYC), Anti-Money Laundering (AML) and Know Your Business (KYB) checks"
     * If company operates a digital platform or handles payments (even via third-parties), or has future plans for ticketing/data platforms, this implies a need for basic checks, qualifying for Level 0
     * Explain this context in comments: "The company is developing a ticketing and data platform that will handle payments and user data, which requires basic AML/KYC/KYB checks for operational compliance, indicating Level 0"
     * If company has NO digital platform, payment handling, or data collection, use Non-existent
   
   - Cyber Security and Data Governance: Level 0 requires "Systems and security patches are up-to-date, and basic cyber threat and data security risk governance elements have been established"
     * If company is developing or operating any digital platform, ticketing system, or data collection system, this implies basic security measures are required for operational functionality, qualifying for Level 0
     * Explain this operational necessity in comments: "The company is developing a ticketing and data platform, which requires basic security measures for operational functionality, indicating Level 0"
     * If company has NO digital infrastructure or data collection, use Non-existent
   
   - Always state in comments WHY it's Level 0 vs Non-existent with specific evidence

Return a JSON object with this exact structure:
{
  "riskManagement": [
    {
      "area": "ESG Policy",
      "definition": "Brief definition",
      "materiality": "High/Medium/Low/Non-existent",
      "level": "Level 0" | "Level 1" | "Level 2" | "Level 3" | "Non-existent",
      "comments": "Detailed assessment comments"
    },
    {
      "area": "ESG Risk and Opportunity Identification",
      ...
    },
    {
      "area": "ESG Reporting",
      ...
    },
    {
      "area": "ESG Performance Management & Monitoring",
      ...
    }
  ],
  "environment": [
    {
      "area": "Environmental impact",
      ...
    },
    {
      "area": "Greenhouse gas emissions",
      ...
    }
  ],
  "social": [
    {
      "area": "Labour Standards",
      ...
    },
    {
      "area": "Occupational Health & Safety Standards",
      ...
    },
    {
      "area": "Child and Forced Labour Policy",
      ...
    },
    {
      "area": "Community Engagement and Impact",
      ...
    },
    {
      "area": "Consumer Protection",
      ...
    },
    {
      "area": "Supply chain risk management",
      ...
    }
  ],
  "governance": [
    {
      "area": "Commitment to Corporate Governance (CG)",
      ...
    },
    {
      "area": "Board Structure and Functioning",
      ...
    },
    {
      "area": "Compliance with Laws & Regulations",
      ...
    },
    {
      "area": "Anti-Bribery and Corruption (ABC) Management",
      ...
    },
    {
      "area": "AML, KYC & KYB Management",
      ...
    },
    {
      "area": "GRM & PPM",
      ...
    },
    {
      "area": "Cyber Security and Data Governance",
      ...
    }
  ],
  "trackRecord": {
    "regulatoryBreaches": "Detailed answer based on web search and company information, or 'None' if no issues found",
    "supplyChainIssues": "Detailed answer based on web search and company information, or 'None' if no issues found",
    "transparencyDisclosure": "Detailed answer based on web search and company information, or 'None' if no issues found",
    "renewableEnergy": "Answer if applicable or 'N/A'"
  }
}

Be thorough and accurate:
- Reference specific criteria from the framework in your comments
- Cite web search results when used to verify information
- Distinguish clearly between "Non-existent" (no evidence) and "Level 0" (basic practices exist)
- For Track Record, use web search results to provide specific details or confirm "None" if no issues found
- Include dates, specific incidents, or context when available from web search
- QUOTE DIRECTLY from company documents - use quotation marks for exact text
- DO NOT invent facts (e.g., employee counts) unless explicitly stated in documents
- For materiality, be generous with High ratings for multi-country, consumer-facing, or community-impact businesses
`;

  console.log(`[DDQ GENERATOR] Calling LLM for DDQ assessment...`);
  
  const result = await callLLMJSON<DDQResult>(prompt, 
    `You are an expert ESG assessor. Analyze companies against the Golden Gate Ventures ESG Risk Management Framework and provide accurate, detailed assessments. 

CRITICAL REQUIREMENTS:

1. LEVEL DETERMINATION:
- "Non-existent" means NO evidence of ANY practices or procedures
- "Level 0" means basic/minimal practices exist (compliance with laws, informal procedures, basic identification)
- Always check Level 0 criteria before choosing "Non-existent"
- Use web search results to verify or enhance your assessment when available
- Be conservative: if there's ANY evidence of basic practices, choose Level 0 over Non-existent

2. MATERIALITY ASSESSMENT:
- Be GENEROUS with High materiality for:
  * Multi-country operations (3+ countries = High)
  * Consumer-facing businesses (ticketing, events, direct customer interaction)
  * Community-impact operations (events, venues, local partnerships)
  * Environmental impact sectors (events, manufacturing, transportation)
  * Digital platforms handling payments/data
- Default to High when in doubt for companies with significant operations

3. COMMENT QUALITY - CRITICAL:
- CRITICAL: When writing comments, you MUST quote directly from documents. If you cannot find a direct quote, you MUST state 'No explicit mention of [topic] in provided documents' and then explain indirect evidence clearly.
- NEVER use inference phrases like 'it is reasonable to infer', 'suggests', 'it is assumed', 'likely', 'may indicate' - these are FORBIDDEN
- ALWAYS quote specific text from documents using quotation marks: "Memo states: '[exact quote]'"
- Reference exact numbers, facts, or statements from company information
- State what evidence exists directly: "Memo states: '[quote]'"
- DO NOT make unsupported claims (e.g., employee counts unless stated)
- For borderline Level 0, explain WHY with specific evidence
- If no direct quote exists, format: "No explicit mention of [topic] in provided documents. However, [specific indirect evidence] indicates [conclusion]"`,
    'openai'
  );

  console.log(`[DDQ GENERATOR] DDQ assessment completed successfully`);
  console.log(`[DDQ GENERATOR] Summary: ${result.riskManagement.length} risk management items, ${result.environment.length} environment items, ${result.social.length} social items, ${result.governance.length} governance items`);

  return result;
}

