import fs from 'fs';
import path from 'path';

let cachedRMF: string | null = null;

/**
 * Loads the ESG Risk Management Framework document
 * Caches the result to avoid repeated file reads
 * Works in both development and Vercel production
 * Uses file system in development, fetch in production as fallback
 */
export async function loadRMF(): Promise<string> {
  if (cachedRMF) {
    return cachedRMF;
  }

  // Try file system first (works in local development)
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'ESG_RMF.txt'),
    path.join(process.cwd(), 'ESG_RMF.txt'),
    path.resolve('./public/ESG_RMF.txt'),
  ];

  let filePath: string | null = null;
  for (const possiblePath of possiblePaths) {
    try {
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  // Try reading from file system if path found
  if (filePath) {
    try {
      cachedRMF = fs.readFileSync(filePath, 'utf-8');
      return cachedRMF;
    } catch (error) {
      console.warn(`[RMF LOADER] File system read failed, trying fetch fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall through to fetch-based approach
    }
  }

  // Fallback to fetch-based approach for Vercel production
  // In Vercel, public files are served from the public directory
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  if (isProduction) {
    try {
      // Try to fetch from public URL
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/ESG_RMF.txt`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ESG_RMF.txt: ${response.status} ${response.statusText}`);
      }
      
      cachedRMF = await response.text();
      
      if (!cachedRMF || cachedRMF.trim().length === 0) {
        throw new Error('ESG_RMF.txt is empty');
      }
      
      console.log(`[RMF LOADER] Successfully loaded RMF via fetch (${cachedRMF.length} characters)`);
      return cachedRMF;
    } catch (fetchError) {
      console.error(`[RMF LOADER] Fetch-based load failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      // Fall through to final error
    }
  }

  // If all methods failed, throw error
  throw new Error(
    'ESG_RMF.txt not found. Please ensure the file exists in the public directory and is committed to Git.'
  );
}

