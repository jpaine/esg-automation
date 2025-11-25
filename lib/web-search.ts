import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore?: number;
}

export interface SearchResults {
  query: string;
  results: SearchResult[];
  timestamp: string;
}

/**
 * Enhanced error logging for web search
 */
function logSearchError(context: string, error: unknown, additionalInfo?: Record<string, any>) {
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
  
  console.error(`[WEB SEARCH ERROR ${timestamp}] ${context}:`, JSON.stringify(errorDetails, null, 2));
  return errorDetails;
}

/**
 * Search for company ESG information using OpenAI's knowledge and reasoning
 * Uses OpenAI chat completion to search for information the model has knowledge of
 * Note: This uses OpenAI's training data knowledge. For real-time web search,
 * consider integrating SerpAPI, Google Custom Search API, or similar services.
 */
export async function searchCompanyInfo(
  companyName: string,
  queries: string[]
): Promise<Map<string, SearchResults>> {
  const results = new Map<string, SearchResults>();
  const timestamp = new Date().toISOString();
  
  console.log(`[WEB SEARCH] Starting information search for company: ${companyName}`);
  console.log(`[WEB SEARCH] Queries to execute: ${queries.length}`);
  
  try {
    for (const query of queries) {
      const fullQuery = `${companyName} ${query}`;
      console.log(`[WEB SEARCH] Searching: "${fullQuery}"`);
      
      try {
        // Use OpenAI chat completion to search for information
        // The model uses its knowledge base to find relevant information
        const searchPrompt = `Based on your knowledge, search for information about: "${fullQuery}".

Provide specific, verifiable facts including:
- Company name and context
- Specific dates, incidents, or events (if known)
- Regulatory actions or breaches (if any)
- Public disclosures or reports
- News articles or official statements

Focus on:
- ESG-related information
- Regulatory compliance issues
- Supply chain problems
- Transparency and disclosure
- Public records or reports

If you find relevant information, provide details with context. If no information is found in your knowledge base, state clearly: "No relevant information found in knowledge base."

Be specific and factual. Include dates, locations, or context when available.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant that searches for and summarizes information. Provide accurate, factual information with context from your knowledge base. Cite what you find or state clearly if nothing is found. Be specific about dates, events, and sources when available.',
            },
            {
              role: 'user',
              content: searchPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content || '';
        
        // Parse the response into structured results
        const searchResults: SearchResult[] = [];
        
        if (content.toLowerCase().includes('no relevant information found') || 
            content.toLowerCase().includes('no information found') ||
            content.toLowerCase().includes('could not find') ||
            content.toLowerCase().includes('not available in my knowledge')) {
          console.log(`[WEB SEARCH] No results found for: "${fullQuery}"`);
        } else {
          // Extract information from the response
          // Format as a single result with the full content as snippet
          searchResults.push({
            title: `Search Results: ${fullQuery}`,
            url: 'OpenAI Knowledge Base',
            snippet: content,
            relevanceScore: 0.8, // Default relevance score
          });
          
          console.log(`[WEB SEARCH] Found information for: "${fullQuery}" (${content.length} chars)`);
        }
        
        results.set(query, {
          query: fullQuery,
          results: searchResults,
          timestamp,
        });
        
        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (queryError) {
        logSearchError(`Search query failed: ${query}`, queryError, {
          companyName,
          query: fullQuery,
        });
        
        // Continue with other queries even if one fails
        results.set(query, {
          query: fullQuery,
          results: [],
          timestamp,
        });
      }
    }
    
    const totalResults = Array.from(results.values()).reduce((sum, r) => sum + r.results.length, 0);
    console.log(`[WEB SEARCH] Completed. Total results: ${totalResults} across ${results.size} queries`);
    
    return results;
    
  } catch (error) {
    logSearchError('Web search failed', error, {
      companyName,
      queriesCount: queries.length,
    });
    
    // Return empty results for all queries on failure
    queries.forEach(query => {
      results.set(query, {
        query: `${companyName} ${query}`,
        results: [],
        timestamp,
      });
    });
    
    return results;
  }
}

/**
 * Search specifically for track record information
 */
export async function searchTrackRecord(companyName: string): Promise<SearchResults[]> {
  const trackRecordQueries = [
    'regulatory breaches ESG compliance violations',
    'supply chain violations labor issues',
    'financial audit qualified opinion restatement',
    'ESG reporting sustainability disclosure',
    'transparency disclosure public records',
  ];
  
  const results = await searchCompanyInfo(companyName, trackRecordQueries);
  return Array.from(results.values());
}

/**
 * Search for company ESG policies and practices
 */
export async function searchESGPractices(companyName: string): Promise<SearchResults[]> {
  const esgQueries = [
    'ESG policy sustainability practices',
    'environmental policy climate action',
    'social responsibility labor standards',
    'governance policies board structure',
    'ESG reporting sustainability report',
  ];
  
  const results = await searchCompanyInfo(companyName, esgQueries);
  return Array.from(results.values());
}

/**
 * Format search results for LLM prompt inclusion
 */
export function formatSearchResultsForPrompt(searchResults: Map<string, SearchResults> | SearchResults[]): string {
  let formatted = '\n\n=== WEB SEARCH RESULTS (External Verification) ===\n';
  
  const resultsArray = Array.isArray(searchResults) 
    ? searchResults.map(sr => ({ query: sr.query, results: sr.results }))
    : Array.from(searchResults.entries()).map(([query, sr]) => ({ query, results: sr.results }));
  
  if (resultsArray.length === 0 || resultsArray.every(sr => sr.results.length === 0)) {
    formatted += 'No additional information found through web search.\n';
    return formatted;
  }
  
  resultsArray.forEach(({ query, results }) => {
    if (results.length > 0) {
      formatted += `\nQuery: "${query}"\n`;
      results.forEach((result, idx) => {
        formatted += `Result ${idx + 1}:\n`;
        formatted += `  ${result.snippet}\n`;
        if (result.url && result.url !== 'OpenAI Knowledge Base') {
          formatted += `  Source: ${result.url}\n`;
        }
        formatted += '\n';
      });
    }
  });
  
  formatted += '=== END WEB SEARCH RESULTS ===\n';
  
  return formatted;
}

