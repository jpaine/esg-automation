'use client';

import { useState, useEffect } from 'react';
import { CompanyInfo, DDQResult, IMResult } from '@/lib/types';

type Step = 'upload' | 'form' | 'ddq' | 'im' | 'complete';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  
  // Helper function to check if a step has data available
  const canNavigateToStep = (targetStep: Step): boolean => {
    switch (targetStep) {
      case 'upload':
        return true; // Always can go back to upload
      case 'form':
        return uploadedText.length > 0 || Object.keys(companyInfo).length > 0;
      case 'ddq':
        return ddqResult !== null;
      case 'im':
        return imResult !== null;
      default:
        return false;
    }
  };
  
  // Step navigation component
  const StepNavigation = () => {
    const steps: { key: Step; label: string; icon: string }[] = [
      { key: 'upload', label: 'Upload/Paste', icon: '📄' },
      { key: 'form', label: 'Company Info', icon: '📝' },
      { key: 'ddq', label: 'DDQ', icon: '📊' },
      { key: 'im', label: 'Investment Memo', icon: '📋' },
    ];
    
    return (
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          {steps.map((stepItem, index) => {
            const isActive = step === stepItem.key;
            const isCompleted = canNavigateToStep(stepItem.key);
            const canNavigate = stepItem.key === 'upload' || isCompleted;
            
            return (
              <div key={stepItem.key} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => canNavigate && setStep(stepItem.key)}
                  disabled={!canNavigate}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : isCompleted
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  } ${canNavigate ? '' : 'opacity-50'}`}
                >
                  <span className="text-lg">{stepItem.icon}</span>
                  <span className="hidden sm:inline">{stepItem.label}</span>
                  {isCompleted && !isActive && (
                    <span className="text-green-600">✓</span>
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    isCompleted ? 'bg-gray-300' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const [uploadedText, setUploadedText] = useState<string>('');
  const [companyInfo, setCompanyInfo] = useState<Partial<CompanyInfo>>({});
  const [ddqResult, setDdqResult] = useState<DDQResult | null>(null);
  const [imResult, setImResult] = useState<IMResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');
  const [formKey, setFormKey] = useState(0); // Force form re-render

  // Debug: Log companyInfo changes
  useEffect(() => {
    if (Object.keys(companyInfo).length > 0) {
      console.log('Company info updated:', companyInfo);
      // Force form re-render when companyInfo changes
      setFormKey(prev => prev + 1);
    }
  }, [companyInfo]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('[FRONTEND] Uploading file:', selectedFile.name, 'Size:', selectedFile.size, 'Type:', selectedFile.type);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('[FRONTEND] Failed to parse response as JSON:', parseError);
        const text = await response.text();
        console.error('[FRONTEND] Response text:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

      console.log('[FRONTEND] Upload response status:', response.status);
      console.log('[FRONTEND] Upload response data:', responseData);

      if (!response.ok) {
        const errorMessage = responseData?.error || `Failed to upload file (Status: ${response.status})`;
        console.error('[FRONTEND] Upload failed:', errorMessage, responseData);
        throw new Error(errorMessage);
      }

      if (!responseData?.text || responseData.text.trim().length === 0) {
        const errorMessage = responseData?.error || 'No text could be extracted from the file';
        console.error('[FRONTEND] No text extracted:', errorMessage, responseData);
        throw new Error(errorMessage);
      }

      const data = responseData;
      setUploadedText(data.text);
      console.log('[FRONTEND] File uploaded successfully, text length:', data.text.length);

      // Auto-extract company info using OpenAI
      setExtracting(true);
      let extractionSuccess = false;
      
      try {
        console.log('Sending text for extraction, length:', data.text?.length || 0);
        console.log('Text preview:', data.text?.substring(0, 200));
        
        const extractResponse = await fetch('/api/extract-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.text }),
        });

        const extractResponseData = await extractResponse.json();
        console.log('Extract API response status:', extractResponse.status);
        console.log('Extract API response:', extractResponseData);

        if (extractResponse.ok && !extractResponseData.error) {
          const extracted = extractResponseData;
          console.log('Extracted data from API:', extracted);
          
          // Merge extracted data, ensuring all required fields are set
          const cleanValue = (val: string | undefined) => {
            if (!val || val.trim() === '') return '';
            if (val.toLowerCase() === 'not specified') return '';
            return val.trim();
          };
          
          const cleanedData = {
            companyName: cleanValue(extracted.companyName) || '',
            sector: cleanValue(extracted.sector) || '',
            subSector: cleanValue(extracted.subSector) || '',
            countriesOfOperation: Array.isArray(extracted.countriesOfOperation) 
              ? extracted.countriesOfOperation.filter((c: string) => c && c.toLowerCase() !== 'not specified' && c.trim() !== '')
              : (extracted.countriesOfOperation && typeof extracted.countriesOfOperation === 'string' && extracted.countriesOfOperation.toLowerCase() !== 'not specified'
                  ? [extracted.countriesOfOperation.trim()] 
                  : []),
            numberOfEmployees: cleanValue(extracted.numberOfEmployees) || '',
            businessActivities: cleanValue(extracted.businessActivities) || '',
            productDescription: cleanValue(extracted.productDescription) || '',
            currentESGPractices: cleanValue(extracted.currentESGPractices),
            policies: cleanValue(extracted.policies),
            complianceStatus: cleanValue(extracted.complianceStatus),
          };
          
          console.log('Cleaned data to set:', cleanedData);
          
          // Set state directly (not functional update) to ensure values are set
          setCompanyInfo(cleanedData);
          extractionSuccess = true;
          
          // Wait longer for React to process the state update and re-render
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('State should be updated now, companyInfo:', cleanedData);
        } else {
          // If extraction fails, show error but continue to form
          const errorMessage = extractResponseData.error || 'Extraction failed';
          console.error('Info extraction failed:', errorMessage, extractResponseData);
          setError(`File uploaded, but automatic information extraction failed: ${errorMessage}. Please fill the form manually.`);
        }
      } catch (extractError) {
        // If extraction fails, continue to form anyway
        console.error('Info extraction error:', extractError);
        setError('File uploaded, but automatic information extraction failed. Please fill the form manually.');
      } finally {
        setExtracting(false);
        setLoading(false);
      }

      // Navigate to form after extraction completes and state is updated
      // Use a small delay to ensure React has processed the state update
      await new Promise(resolve => setTimeout(resolve, 100));
      setStep('form');
    } catch (err) {
      console.error('[FRONTEND] Upload error caught:', err);
      let errorMessage = 'Upload failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else {
        errorMessage = 'An unexpected error occurred during upload';
      }
      
      // Check for network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network error: Could not connect to server. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
      setExtracting(false);
    } finally {
      setLoading(false);
      setExtracting(false);
    }
  };

  const handlePasteText = async () => {
    if (!pastedText || !pastedText.trim()) {
      setError('Please paste some text first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[FRONTEND] Processing pasted text, length:', pastedText.length);
      setUploadedText(pastedText.trim());

      // Auto-extract company info using OpenAI
      setExtracting(true);
      let extractionSuccess = false;
      
      try {
        console.log('Sending text for extraction, length:', pastedText.trim().length);
        console.log('Text preview:', pastedText.trim().substring(0, 200));
        
        const extractResponse = await fetch('/api/extract-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText.trim() }),
        });

        const extractResponseData = await extractResponse.json();
        console.log('Extract API response status:', extractResponse.status);
        console.log('Extract API response:', extractResponseData);

        if (extractResponse.ok && !extractResponseData.error) {
          const extracted = extractResponseData;
          console.log('Extracted data from API:', extracted);
          
          // Validate that we have complete data before proceeding
          const hasRequiredFields = 
            extracted.companyName && extracted.companyName.trim().length > 0 &&
            extracted.sector && extracted.sector.trim().length > 0 &&
            extracted.subSector && extracted.subSector.trim().length > 0 &&
            Array.isArray(extracted.countriesOfOperation) && extracted.countriesOfOperation.length > 0 &&
            extracted.numberOfEmployees && extracted.numberOfEmployees.trim().length > 0 &&
            extracted.businessActivities && extracted.businessActivities.trim().length >= 50 &&
            extracted.productDescription && extracted.productDescription.trim().length >= 50;
          
          if (!hasRequiredFields) {
            const missingFields = [];
            if (!extracted.companyName || extracted.companyName.trim().length === 0) missingFields.push('Company Name');
            if (!extracted.sector || extracted.sector.trim().length === 0) missingFields.push('Sector');
            if (!extracted.subSector || extracted.subSector.trim().length === 0) missingFields.push('Sub-sector');
            if (!Array.isArray(extracted.countriesOfOperation) || extracted.countriesOfOperation.length === 0) missingFields.push('Countries of Operation');
            if (!extracted.numberOfEmployees || extracted.numberOfEmployees.trim().length === 0) missingFields.push('Number of Employees');
            if (!extracted.businessActivities || extracted.businessActivities.trim().length < 50) missingFields.push('Business Activities (too short)');
            if (!extracted.productDescription || extracted.productDescription.trim().length < 50) missingFields.push('Product Description (too short)');
            
            console.error('Extraction incomplete, missing fields:', missingFields);
            setError(`Extraction incomplete. Missing or incomplete fields: ${missingFields.join(', ')}. Please ensure your document contains complete company information and try again.`);
            setExtracting(false);
            setLoading(false);
            return; // Don't proceed to form
          }
          
          // Merge extracted data, ensuring all required fields are set
          const cleanValue = (val: string | undefined) => {
            if (!val || val.trim() === '') return '';
            if (val.toLowerCase() === 'not specified') return '';
            return val.trim();
          };
          
          const cleanedData = {
            companyName: cleanValue(extracted.companyName) || '',
            sector: cleanValue(extracted.sector) || '',
            subSector: cleanValue(extracted.subSector) || '',
            countriesOfOperation: Array.isArray(extracted.countriesOfOperation) 
              ? extracted.countriesOfOperation.filter((c: string) => c && c.toLowerCase() !== 'not specified' && c.trim() !== '')
              : (extracted.countriesOfOperation && typeof extracted.countriesOfOperation === 'string' && extracted.countriesOfOperation.toLowerCase() !== 'not specified'
                  ? [extracted.countriesOfOperation.trim()] 
                  : []),
            numberOfEmployees: cleanValue(extracted.numberOfEmployees) || '',
            businessActivities: cleanValue(extracted.businessActivities) || '',
            productDescription: cleanValue(extracted.productDescription) || '',
            currentESGPractices: cleanValue(extracted.currentESGPractices),
            policies: cleanValue(extracted.policies),
            complianceStatus: cleanValue(extracted.complianceStatus),
          };
          
          console.log('Cleaned data to set:', cleanedData);
          
          // Set state directly (not functional update) to ensure values are set
          setCompanyInfo(cleanedData);
          
          // Increment formKey to force form re-render
          setFormKey(prev => prev + 1);
          
          extractionSuccess = true;
          
          // Show warning if extraction was limited, but don't treat it as a failure
          if (extracted.warning) {
            setError(extracted.warning);
          }
          
          // Wait longer for React to process the state update and re-render
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('State should be updated now, companyInfo:', cleanedData);
        } else {
          // If extraction fails completely, show error but continue to form
          const errorMessage = extractResponseData.error || 'Extraction failed';
          console.error('Info extraction failed:', errorMessage, extractResponseData);
          setError(`Text processed, but automatic information extraction failed: ${errorMessage}. Please fill the form manually.`);
        }
      } catch (extractError) {
        // If extraction fails, continue to form anyway
        console.error('Info extraction error:', extractError);
        setError('Text processed, but automatic information extraction failed. Please fill the form manually.');
      } finally {
        setExtracting(false);
        setLoading(false);
      }

      // Navigate to form after extraction completes and state is updated
      // Use a small delay to ensure React has processed the state update
      await new Promise(resolve => setTimeout(resolve, 100));
      setStep('form');
    } catch (err) {
      console.error('[FRONTEND] Paste text error caught:', err);
      let errorMessage = 'Failed to process text';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else {
        errorMessage = 'An unexpected error occurred while processing text';
      }
      
      // Check for network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network error: Could not connect to server. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
      setExtracting(false);
    } finally {
      setLoading(false);
      setExtracting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate-ddq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyInfo,
          extractedText: uploadedText,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate DDQ');

      const ddq = await response.json();
      setDdqResult(ddq);
      setStep('ddq');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DDQ generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIM = async () => {
    if (!ddqResult) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate-im', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyInfo,
          ddqResult,
          extractedText: uploadedText,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate IM');

      const im = await response.json();
      setImResult(im);
      setStep('im');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IM generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDDQ = async () => {
    if (!ddqResult) return;

    try {
      const response = await fetch('/api/download-ddq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddqResult }),
      });

      if (!response.ok) throw new Error('Failed to download DDQ');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ESG_DDQ.docx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDownloadIM = async () => {
    if (!imResult) return;

    try {
      const response = await fetch('/api/download-im', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imResult }),
      });

      if (!response.ok) throw new Error('Failed to download IM');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ESG_Investment_Memo.docx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-8">
          ESG Form Automation
          </h1>

        {/* Progress Steps - Clickable Navigation */}
        <div className="mb-8 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            {(['upload', 'form', 'ddq', 'im'] as Step[]).map((s, idx) => {
              const isActive = step === s;
              const isCompleted = canNavigateToStep(s);
              const canNavigate = s === 'upload' || isCompleted;
              const stepLabels = ['Upload/Paste', 'Company Info', 'DDQ', 'Investment Memo'];
              const stepIcons = ['📄', '📝', '📊', '📋'];
              
              return (
                <div key={s} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (canNavigate) {
                        setStep(s);
                        setError('');
                      }
                    }}
                    disabled={!canNavigate}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-all min-w-[80px] ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : isCompleted
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                    } ${canNavigate ? '' : 'cursor-not-allowed'}`}
                    title={canNavigate ? `Go to ${stepLabels[idx]}` : 'Complete previous steps first'}
                  >
                    <span className="text-xl">{stepIcons[idx]}</span>
                    <span className="text-xs font-medium">{stepLabels[idx]}</span>
                    {isCompleted && !isActive && (
                      <span className="text-green-600 text-xs">✓</span>
                    )}
                  </button>
                  {idx < 3 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      isCompleted ? 'bg-gray-300' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Step 1: Upload Company Documents or Paste Text</h2>
            <p className="text-black mb-4">
              Choose to either upload company documents (PDF, Word, or text files) or paste text directly. Then click "Process" to extract information automatically.
            </p>

            {/* Input Method Toggle */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod('file');
                    setSelectedFile(null);
                    setPastedText('');
                    setError('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    inputMethod === 'file'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod('text');
                    setSelectedFile(null);
                    setPastedText('');
                    setError('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    inputMethod === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {/* File Upload Option */}
            {inputMethod === 'file' && (
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  disabled={loading || extracting}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-black">
                      <strong>Selected file:</strong> {selectedFile.name}
                      <span className="text-gray-700 ml-2">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
          </p>
        </div>
                )}
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || loading || extracting}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Uploading...' : extracting ? 'Processing...' : 'Upload and Process'}
                </button>
                {loading && <p className="text-sm text-gray-800 text-center">Uploading and processing file...</p>}
                {extracting && <p className="text-sm text-blue-700 text-center">Extracting company information using AI...</p>}
              </div>
            )}

            {/* Text Paste Option */}
            {inputMethod === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Paste Company Information
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      setError('');
                    }}
                    placeholder="Paste company information, pitch deck content, or any relevant text here..."
                    rows={12}
                    disabled={loading || extracting}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm text-black"
                  />
                  {pastedText && (
                    <p className="mt-2 text-sm text-gray-700">
                      {pastedText.length} characters
                    </p>
                  )}
                </div>
                <button
                  onClick={handlePasteText}
                  disabled={!pastedText || !pastedText.trim() || loading || extracting}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Processing...' : extracting ? 'Extracting...' : 'Process Text'}
                </button>
                {loading && <p className="text-sm text-gray-800 text-center">Processing text...</p>}
                {extracting && <p className="text-sm text-blue-700 text-center">Extracting company information using AI...</p>}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Company Information</h2>
            {extracting && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                AI is extracting information from your document...
              </div>
            )}
            {companyInfo.companyName && companyInfo.companyName.trim() !== '' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
                ✓ Information extracted from document. Please review and edit as needed.
              </div>
            )}
            {/* Debug: Show extracted data in development */}
            {process.env.NODE_ENV === 'development' && Object.keys(companyInfo).length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-900">
                <strong>Debug - Extracted Data:</strong>
                <pre className="mt-2 overflow-auto max-h-40 text-gray-900">
                  {JSON.stringify(companyInfo, null, 2)}
                </pre>
              </div>
            )}
            <form key={formKey} onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black">Company Name *</label>
                <input
                  type="text"
                  required
                  key={`companyName-${formKey}-${companyInfo.companyName || 'empty'}`}
                  value={companyInfo.companyName ?? ''}
                  placeholder="e.g., FDcare (fka Helicare)"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Sector *</label>
                <input
                  type="text"
                  required
                  key={`sector-${formKey}-${companyInfo.sector || 'empty'}`}
                  value={companyInfo.sector ?? ''}
                  placeholder="e.g., Healthcare, FinTech, EduTech"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, sector: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Sub-sector *</label>
                <input
                  type="text"
                  required
                  key={`subSector-${formKey}-${companyInfo.subSector || 'empty'}`}
                  value={companyInfo.subSector ?? ''}
                  placeholder="e.g., Primary Care and Homecare Services"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, subSector: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Countries of Operation *</label>
                <input
                  type="text"
                  required
                  key={`countries-${formKey}-${companyInfo.countriesOfOperation?.join(',') || 'empty'}`}
                  placeholder="Comma-separated (e.g., Vietnam, Singapore)"
                  value={companyInfo.countriesOfOperation?.join(', ') ?? ''}
                  onChange={(e) =>
                    setCompanyInfo({
                      ...companyInfo,
                      countriesOfOperation: e.target.value.split(',').map((c) => c.trim()).filter((c) => c),
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Number of Employees *</label>
                <input
                  type="text"
                  required
                  key={`employees-${formKey}-${companyInfo.numberOfEmployees || 'empty'}`}
                  value={companyInfo.numberOfEmployees ?? ''}
                  placeholder="e.g., <30, 50-100, 100-200"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, numberOfEmployees: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Business Activities *</label>
                <textarea
                  required
                  rows={4}
                  key={`business-${formKey}-${companyInfo.businessActivities?.substring(0, 20) || 'empty'}`}
                  value={companyInfo.businessActivities ?? ''}
                  placeholder="Describe what the company does, its business model, and operations"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, businessActivities: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Product/Service Description *</label>
                <textarea
                  required
                  rows={4}
                  key={`product-${formKey}-${companyInfo.productDescription?.substring(0, 20) || 'empty'}`}
                  value={companyInfo.productDescription ?? ''}
                  placeholder="Describe the main product or service offering, including target customers and value proposition"
                  onChange={(e) => setCompanyInfo({ ...companyInfo, productDescription: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-black hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating DDQ...' : 'Generate DDQ'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: DDQ Review */}
        {step === 'ddq' && ddqResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-black">Step 3: DDQ Assessment</h2>
              <button
                onClick={handleDownloadDDQ}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Download DDQ (Word)
              </button>
            </div>
            
            <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2">
              {/* Risk Management Capacity */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-xl font-bold text-black mb-4">Risk Management Capacity</h3>
                <div className="space-y-4">
                  {ddqResult.riskManagement.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-black mb-2">{item.area}</h4>
                      {item.definition && (
                        <p className="text-sm text-gray-700 mb-2 italic">{item.definition}</p>
                      )}
                      <div className="flex gap-4 mb-2">
                        <span className="text-sm">
                          <strong className="text-black">Level:</strong> <span className="text-gray-800">{item.level}</span>
                        </span>
                        {item.materiality && (
                          <span className="text-sm">
                            <strong className="text-black">Materiality:</strong> <span className="text-gray-800">{item.materiality}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-black mt-2 whitespace-pre-wrap">{item.comments}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-xl font-bold text-black mb-4">Environment</h3>
                <div className="space-y-4">
                  {ddqResult.environment.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-black mb-2">{item.area}</h4>
                      {item.definition && (
                        <p className="text-sm text-gray-700 mb-2 italic">{item.definition}</p>
                      )}
                      <div className="flex gap-4 mb-2">
                        <span className="text-sm">
                          <strong className="text-black">Level:</strong> <span className="text-gray-800">{item.level}</span>
                        </span>
                        {item.materiality && (
                          <span className="text-sm">
                            <strong className="text-black">Materiality:</strong> <span className="text-gray-800">{item.materiality}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-black mt-2 whitespace-pre-wrap">{item.comments}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-xl font-bold text-black mb-4">Social</h3>
                <div className="space-y-4">
                  {ddqResult.social.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-black mb-2">{item.area}</h4>
                      {item.definition && (
                        <p className="text-sm text-gray-700 mb-2 italic">{item.definition}</p>
                      )}
                      <div className="flex gap-4 mb-2">
                        <span className="text-sm">
                          <strong className="text-black">Level:</strong> <span className="text-gray-800">{item.level}</span>
                        </span>
                        {item.materiality && (
                          <span className="text-sm">
                            <strong className="text-black">Materiality:</strong> <span className="text-gray-800">{item.materiality}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-black mt-2 whitespace-pre-wrap">{item.comments}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Governance */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-xl font-bold text-black mb-4">Governance</h3>
                <div className="space-y-4">
                  {ddqResult.governance.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-black mb-2">{item.area}</h4>
                      {item.definition && (
                        <p className="text-sm text-gray-700 mb-2 italic">{item.definition}</p>
                      )}
                      <div className="flex gap-4 mb-2">
                        <span className="text-sm">
                          <strong className="text-black">Level:</strong> <span className="text-gray-800">{item.level}</span>
                        </span>
                        {item.materiality && (
                          <span className="text-sm">
                            <strong className="text-black">Materiality:</strong> <span className="text-gray-800">{item.materiality}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-black mt-2 whitespace-pre-wrap">{item.comments}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Track Record */}
              {(ddqResult.trackRecord.regulatoryBreaches || 
                ddqResult.trackRecord.supplyChainIssues || 
                ddqResult.trackRecord.transparencyDisclosure || 
                ddqResult.trackRecord.renewableEnergy) && (
                <div className="pb-6">
                  <h3 className="text-xl font-bold text-black mb-4">Track Record</h3>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    {ddqResult.trackRecord.regulatoryBreaches && (
                      <div>
                        <strong className="text-black">Regulatory Breaches:</strong>
                        <p className="text-sm text-black mt-1 whitespace-pre-wrap">{ddqResult.trackRecord.regulatoryBreaches}</p>
                      </div>
                    )}
                    {ddqResult.trackRecord.supplyChainIssues && (
                      <div>
                        <strong className="text-black">Supply Chain Issues:</strong>
                        <p className="text-sm text-black mt-1 whitespace-pre-wrap">{ddqResult.trackRecord.supplyChainIssues}</p>
                      </div>
                    )}
                    {ddqResult.trackRecord.transparencyDisclosure && (
                      <div>
                        <strong className="text-black">Transparency & Disclosure:</strong>
                        <p className="text-sm text-black mt-1 whitespace-pre-wrap">{ddqResult.trackRecord.transparencyDisclosure}</p>
                      </div>
                    )}
                    {ddqResult.trackRecord.renewableEnergy && (
                      <div>
                        <strong className="text-black">Renewable Energy:</strong>
                        <p className="text-sm text-black mt-1 whitespace-pre-wrap">{ddqResult.trackRecord.renewableEnergy}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setStep('form')}
                className="px-4 py-2 border border-gray-300 rounded-md text-black hover:bg-gray-50 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleGenerateIM}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Generating IM...' : 'Generate Investment Memo'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: IM Review */}
        {step === 'im' && imResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-black">Step 4: Investment Memo</h2>
              <button
                onClick={handleDownloadIM}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Download IM (Word)
              </button>
            </div>
            
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
              {/* Company Name */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black">
                  <strong>Company Name:</strong> {imResult.companyName}
                </p>
              </div>

              {/* Product/Activity/Solution */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black">
                  <strong>Product/ Activity/ Solution:</strong> {imResult.productActivitySolution}
                </p>
              </div>

              {/* Findings from ESG Due Diligence */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-xl font-bold text-black mb-4">Findings from the ESG Due Diligence</h3>
                
                <div className="space-y-3">
                  <p className="text-black">
                    <strong>Risk Category (Category C/B+/B):</strong>
                  </p>
                  <p className="text-black ml-4">{imResult.riskCategory}</p>
                  
                  <p className="text-black">
                    <strong>Accessibility of grievance redress mechanism (include website link):</strong>
                  </p>
                  <p className="text-black ml-4">{imResult.grievanceRedressMechanism}</p>
                  
                  <p className="text-black">
                    <strong>Sector & sub-sector:</strong>
                  </p>
                  <p className="text-black ml-4">{imResult.sector} - {imResult.subSector}</p>
                  
                  <p className="text-black">
                    <strong>Countries of operation:</strong>
                  </p>
                  <p className="text-black ml-4">{imResult.countriesOfOperation}</p>
                  
                  <p className="text-black">
                    <strong>No. of Employees:</strong>
                  </p>
                  <p className="text-black ml-4">{imResult.numberOfEmployees}</p>
                </div>
              </div>

              {/* Current risks and opportunities */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Current risks and opportunities</p>
                
                <p className="text-black mb-2">Current Risks:</p>
                {imResult.currentRisks && imResult.currentRisks.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.currentRisks.map((risk, idx) => (
                      <li key={idx} className="text-black">* {risk}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
                
                <p className="text-black mb-2 mt-4">Current Opportunities:</p>
                {imResult.currentOpportunities && imResult.currentOpportunities.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.currentOpportunities.map((opp, idx) => (
                      <li key={idx} className="text-black">* {opp}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
              </div>

              {/* Long-term risks and opportunities */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Long-term risks and opportunities</p>
                
                <p className="text-black mb-2">Long term risks</p>
                {imResult.longTermRisks && imResult.longTermRisks.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.longTermRisks.map((risk, idx) => (
                      <li key={idx} className="text-black">* {risk}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
                
                <p className="text-black mb-2 mt-4">Long term opportunities</p>
                {imResult.longTermOpportunities && imResult.longTermOpportunities.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.longTermOpportunities.map((opp, idx) => (
                      <li key={idx} className="text-black">* {opp}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
              </div>

              {/* Founders' commitment */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Founders' commitment to and company capacity on ESG risk management</p>
                <p className="text-black whitespace-pre-wrap">{imResult.foundersCommitment}</p>
              </div>

              {/* Stakeholder consultations, grievances, retaliation */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Highlights of the relevant stakeholder consultations conducted, potential grievances, and risk of retaliation that could emerge and commitment to a stakeholder engagement plan.</p>
                <p className="text-black mb-2 mt-4">Stakeholder Consultations: {imResult.stakeholderConsultations}</p>
                <p className="text-black mb-2 mt-4">Potential Grievances: {imResult.potentialGrievances}</p>
                <p className="text-black mb-2 mt-4">Risk of Retaliation: {imResult.riskOfRetaliation}</p>
              </div>

              {/* Gaps and Action Plan */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Gaps in the fund's ESG requirements and proposed action plan to address gaps</p>
                
                <p className="text-black mb-2 mt-4">Gaps:</p>
                {imResult.gaps && imResult.gaps.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.gaps.map((gap, idx) => (
                      <li key={idx} className="text-black">* {gap}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
                
                <p className="text-black mb-2 mt-4">Action Plan:</p>
                {imResult.actionPlan && imResult.actionPlan.length > 0 ? (
                  <ul className="list-none space-y-2 ml-4">
                    {imResult.actionPlan.map((action, idx) => (
                      <li key={idx} className="text-black">* {action}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-black ml-4">None identified</p>
                )}
              </div>

              {/* Estimated cost and timeframe */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-black font-bold mb-2">Estimated cost of corrective actions and timeframe</p>
                <p className="text-black mt-2">{imResult.estimatedCost || 'Not available'}</p>
                {imResult.timeframe && (
                  <p className="text-black mt-2">{imResult.timeframe}</p>
                )}
              </div>

              {/* Limitations */}
              {imResult.limitations && imResult.limitations.length > 0 && (
                <div className="pb-4">
                  <p className="text-black font-bold mb-2">Limitation of ESG due diligence</p>
                  <div className="space-y-2 mt-2">
                    {imResult.limitations.map((lim, idx) => (
                      <p key={idx} className="text-black">{idx + 1}. {lim}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setStep('ddq')}
                className="px-4 py-2 border border-gray-300 rounded-md text-black hover:bg-gray-50 font-medium"
              >
                Back
              </button>
            </div>
          </div>
        )}
        </div>
    </div>
  );
}
