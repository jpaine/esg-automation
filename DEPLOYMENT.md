# Vercel Deployment Checklist

## Pre-Deployment

- [x] RMF loader updated for Vercel compatibility (with fetch fallback)
- [x] All TypeScript errors resolved
- [x] vercel.json configured with 60s timeout
- [x] Environment variables documented
- [x] Unused dependencies removed (pdfjs-dist)
- [x] File size validation added (4.5MB limit)
- [x] Environment variable validation added to API routes

## Deployment Steps

### 1. Local Testing
```bash
cd esg-automation
npm run build
npm start
```
Test the application locally to ensure everything works.

### 2. Git Setup
```bash
git init  # if not already initialized
git add .
git commit -m "Initial ESG automation system"
git remote add origin <your-repo-url>
git push -u origin main
```

### 3. Vercel Deployment

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your Git repository**
4. **Configure Project Settings**:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `esg-automation` (if repo root is AIIB)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

5. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add:
     ```
     OPENAI_API_KEY = your_openai_api_key_here
     GEMINI_API_KEY = your_gemini_api_key_here
     ```
   - Optional:
     ```
     ANTHROPIC_API_KEY = your_anthropic_api_key_here
     ```

6. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### 4. Post-Deployment Testing

1. Visit your deployed URL
2. Test the full workflow:
   - Upload a test document
   - Fill company information
   - Generate DDQ
   - Generate IM
   - Download documents

### 5. Troubleshooting

**If RMF file not found:**
- Verify `public/ESG_RMF.txt` exists in the repository (should be ~112KB)
- Check that the file is committed to Git (not in .gitignore)
- The loader will try file system first, then fetch from public URL as fallback
- Check Vercel function logs for specific error messages

**If API routes timeout:**
- Check vercel.json has `maxDuration: 60` set (already configured)
- LLM calls may take 30-60 seconds for complex assessments
- Consider upgrading to Vercel Pro for 300s timeout if needed
- Monitor function logs to identify which step is slow

**If LLM calls fail:**
- Verify environment variables are set correctly in Vercel dashboard
- Check API key has sufficient credits/quota
- Review Vercel function logs for error details
- Error messages will now indicate if API key is missing

**If file upload fails:**
- Maximum file size is 4.5MB (Vercel's request body limit)
- Error message will indicate if file is too large
- For larger files, consider splitting or compressing before upload

**If build fails:**
- Ensure all dependencies are in package.json (pdfjs-dist has been removed)
- Run `npm install` locally to verify dependencies resolve
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify Next.js version compatibility (16.0.3)

**Common Vercel-specific issues:**
- **File system access**: RMF loader uses fetch fallback in production
- **Environment variables**: Must be set in Vercel dashboard, not .env files
- **Function cold starts**: First request may be slower (10-30s)
- **Memory limits**: Free tier has 1024MB, should be sufficient

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4 |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for PDF OCR (fallback for image-based PDFs) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for Claude (alternative) |

## Notes

- The `public/ESG_RMF.txt` file must be committed to Git (~112KB)
- API routes have a 60-second timeout (configured in vercel.json)
- All processing happens server-side via API routes
- No database required - stateless operation
- Maximum file upload size: 4.5MB (Vercel's request body limit)
- RMF loader uses file system in development, fetch in production
- Environment variables must be set in Vercel dashboard (not .env files)

## Deployment Verification Checklist

After deployment, verify:
1. ✅ Homepage loads correctly
2. ✅ File upload accepts PDF/Word/TXT files
3. ✅ File size validation works (try uploading >4.5MB file)
4. ✅ Company info extraction works
5. ✅ DDQ generation completes (may take 30-60s)
6. ✅ IM generation completes (may take 30-60s)
7. ✅ Document downloads work (Word format)
8. ✅ Error messages are clear and helpful
9. ✅ Vercel function logs show no errors
10. ✅ RMF file loads successfully (check logs)

