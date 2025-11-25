import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Lazy initialization to avoid build-time errors when env vars aren't set
let openaiInstance: OpenAI | null = null;
let anthropicInstance: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

function getAnthropic(): Anthropic {
  if (!anthropicInstance) {
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicInstance;
}

type LLMProvider = 'openai' | 'anthropic';

/**
 * Enhanced error logging helper for LLM calls
 */
function logLLMError(context: string, error: unknown, additionalInfo?: Record<string, any>) {
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
  
  console.error(`[LLM ERROR ${timestamp}] ${context}:`, JSON.stringify(errorDetails, null, 2));
  return errorDetails;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Call LLM with a prompt and return the response
 */
export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  provider: LLMProvider = 'openai'
): Promise<LLMResponse> {
  const startTime = Date.now();
  const requestInfo = {
    provider,
    promptLength: prompt.length,
    systemPromptLength: systemPrompt?.length || 0,
    hasApiKey: provider === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY,
  };
  
  console.log(`[LLM INFO] Starting ${provider} API call...`, requestInfo);
  
  try {
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const anthropic = getAnthropic();
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful assistant that analyzes ESG compliance for investment companies.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseTime = Date.now() - startTime;
      const response = {
        content: message.content[0].type === 'text' ? message.content[0].text : '',
        usage: message.usage ? {
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
        } : undefined,
      };
      
      console.log(`[LLM INFO] Anthropic API call successful in ${responseTime}ms`, {
        responseLength: response.content.length,
        usage: response.usage,
      });
      
      return response;
    } else {
      // Default to OpenAI
      if (!process.env.OPENAI_API_KEY) {
        const error = new Error('OPENAI_API_KEY is not set');
        logLLMError('Missing API key', error, { provider, requestInfo });
        throw error;
      }
      
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: 0.3,
      });

      const responseTime = Date.now() - startTime;
      const result = {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
        } : undefined,
      };
      
      if (!result.content) {
        console.warn('[LLM WARN] OpenAI API returned empty content', {
          responseId: response.id,
          choices: response.choices.length,
          finishReason: response.choices[0]?.finish_reason,
        });
      }
      
      console.log(`[LLM INFO] OpenAI API call successful in ${responseTime}ms`, {
        responseLength: result.content.length,
        usage: result.usage,
        model: response.model,
      });
      
      return result;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        logLLMError('API authentication failed', error, {
          ...requestInfo,
          responseTime,
          errorType: 'authentication',
        });
        throw new Error(`LLM API authentication failed. Please check your ${provider.toUpperCase()} API key.`);
      }
      
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        logLLMError('Rate limit exceeded', error, {
          ...requestInfo,
          responseTime,
          errorType: 'rate_limit',
        });
        throw new Error('LLM API rate limit exceeded. Please try again later.');
      }
      
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        logLLMError('Request timeout', error, {
          ...requestInfo,
          responseTime,
          errorType: 'timeout',
        });
        throw new Error('LLM API request timed out. Please try again.');
      }
    }
    
    logLLMError('LLM API call failed', error, {
      ...requestInfo,
      responseTime,
    });
    throw error;
  }
}

/**
 * Call LLM with JSON response format
 */
export async function callLLMJSON<T>(
  prompt: string,
  systemPrompt?: string,
  provider: LLMProvider = 'openai'
): Promise<T> {
  const startTime = Date.now();
  console.log(`[LLM JSON] Starting JSON extraction with ${provider}...`);
  
  try {
    const response = await callLLM(
      `${prompt}\n\nRespond with valid JSON only, no markdown formatting.`,
      systemPrompt,
      provider
    );

    if (!response.content || !response.content.trim()) {
      const error = new Error('LLM returned empty response');
      logLLMError('Empty LLM response', error, {
        provider,
        promptLength: prompt.length,
      });
      throw error;
    }

    try {
      // Remove markdown code blocks if present
      let cleaned = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON if it's embedded in other text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleaned) as T;
      const parseTime = Date.now() - startTime;
      
      console.log(`[LLM JSON] Successfully parsed JSON response in ${parseTime}ms`, {
        responseLength: response.content.length,
        cleanedLength: cleaned.length,
        parsedKeys: Object.keys(parsed as object),
      });
      
      return parsed;
    } catch (parseError) {
      const parseTime = Date.now() - startTime;
      logLLMError('JSON parsing failed', parseError, {
        provider,
        responseLength: response.content.length,
        responsePreview: response.content.substring(0, 500),
        parseTime,
      });
      
      throw new Error(`Invalid JSON response from LLM. Response preview: ${response.content.substring(0, 200)}...`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid JSON')) {
      throw error; // Re-throw JSON parsing errors as-is
    }
    
    logLLMError('JSON extraction failed', error, {
      provider,
      promptLength: prompt.length,
    });
    throw error;
  }
}

