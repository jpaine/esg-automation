# ESG Form Automation System

Automated ESG Due Diligence Questionnaire (DDQ) and Investment Memo (IM) generation system using LLM analysis against the Golden Gate Ventures ESG Risk Management Framework.

## Features

- **Document Upload**: Upload company documents (PDF, Word, text) to extract information
- **Company Information Form**: Structured form to collect company details
- **Automated DDQ Generation**: LLM-powered assessment against ESG framework
- **Automated IM Generation**: Investment memo generation based on DDQ results
- **Document Export**: Download filled DDQ and IM as Word documents

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: Use Anthropic instead
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Deployment to Vercel

1. **Push to GitHub** (or your Git provider)

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your repository

3. **Configure Environment Variables**:
   - In Vercel project settings, add:
     - `OPENAI_API_KEY` (required)
     - `GEMINI_API_KEY` (required for PDF OCR)
     - `ANTHROPIC_API_KEY` (optional)

4. **Deploy**:
   - Vercel will automatically deploy on push
   - Or click "Deploy" in the dashboard

## Usage

1. **Upload Documents**: Upload company documents (PDF, Word, or text files)
2. **Fill Company Info**: Complete the company information form (auto-filled from documents if available)
3. **Review DDQ**: Review the generated DDQ assessment and download if needed
4. **Generate IM**: Generate the Investment Memo based on DDQ results
5. **Download**: Download the completed Investment Memo as a Word document

## Architecture

- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **LLM**: OpenAI GPT-4 or Anthropic Claude
- **Document Processing**: Google Gemini API (PDFs - handles both text and image-based), mammoth (Word documents)
- **Document Generation**: docx library

## File Structure

```
/
├── app/
│   ├── page.tsx (main UI)
│   ├── api/
│   │   ├── upload/route.ts
│   │   ├── extract-info/route.ts
│   │   ├── generate-ddq/route.ts
│   │   ├── generate-im/route.ts
│   │   ├── download-ddq/route.ts
│   │   └── download-im/route.ts
│   └── layout.tsx
├── lib/
│   ├── llm-client.ts (LLM API wrapper)
│   ├── rmf-loader.ts (RMF document loader)
│   ├── document-processor.ts (file parsing)
│   ├── document-generator.ts (Word doc generation)
│   ├── ddq-generator.ts (DDQ generation logic)
│   ├── im-generator.ts (IM generation logic)
│   └── types.ts (TypeScript types)
├── public/
│   └── ESG_RMF.txt (knowledge base)
└── vercel.json
```

## Notes

- The ESG_RMF.txt file is included in full in LLM prompts (no RAG/vector DB needed)
- The system uses direct LLM API calls (no agent framework needed)
- All processing happens server-side via API routes
- Documents are generated as Word (.docx) files
