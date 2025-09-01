import React, { useState } from 'react';
import { generateCombinedEmailBodyHTML, generateCombinedEmailBodyText } from './components/analysis/emailUtils';

import FileUpload from './components/analysis/FileUpload';
import InsightReport from './components/analysis/InsightReport';
import LoadingSpinner from './components/analysis/LoadingSpinner';
import BulkUrlModal from './components/analysis/BulkUrlModal';

interface Insight {
  id: string;
  original_file_name: string;
  company_name: string;
  analysis_result: {
    report_metadata: {
      humanized_intro: string;
      reporting_period_start: string;
      reporting_period_end: string;
    };
    categories: Array<{
      category_name: string;
      findings: Array<{
        summary_line: string;
        severity: string;
        trend: string;
        last_occurrence: string;
        avg_duration_minutes: number;
        total_occurrences: number;
        impacted_clients?: number;
        error_rate?: string;
        client_change?: string;
      }>;
    }>;
    recommendations: string[];
  };
  full_report_url?: string;
  categoryVisuals?: any[];
}

export default function AnalysisPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [recipientName, setRecipientName] = useState('');
    const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisStep, setAnalysisStep] = useState('');

    // Modern styling for professional look
    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const handleFileChange = (selectedFiles: FileList) => {
        const supportedFiles = Array.from(selectedFiles).filter(file => 
            file.type === 'application/pdf'
        );
        if (supportedFiles.length > 0) {
            setFiles(prevFiles => [...prevFiles, ...supportedFiles]);
            setError(null);
            setInsights([]);
        } else if (selectedFiles.length > 0) {
            setError('Please upload valid PDF files only.');
        }
    };

    const handleAnalyze = async (customerLocation?: string) => {
        if (files.length === 0) {
            setError('Please select one or more files to analyze.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setInsights([]);
        setAnalysisProgress(0);
        setAnalysisStep('Initializing analysis...');
        let processedInsights: Insight[] = [];

        try {
            setAnalysisProgress(10);
            setAnalysisStep('Preparing files for analysis...');
            
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
            });
            
            // Add customer location if provided
            if (customerLocation) {
                formData.append('timezone', customerLocation);
            }

            setAnalysisProgress(20);
            setAnalysisStep('Uploading files to server...');

            const response = await fetch('http://localhost:3001/api/analyze', {
                method: 'POST',
                body: formData,
            });

            setAnalysisProgress(50);
            setAnalysisStep('Processing PDF content...');

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            setAnalysisProgress(80);
            setAnalysisStep('Generating comprehensive analysis...');

            if (data.success && data.results) {
                processedInsights = data.results.map((result: any, index: number) => ({
                    id: `insight-${index}`,
                    ...result
                }));
                setInsights(processedInsights);
            } else {
                throw new Error('Invalid response from analysis service');
            }

            setAnalysisProgress(100);
            setAnalysisStep('Analysis complete!');

        } catch (err) {
            console.error('Analysis error:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
            setAnalysisProgress(0);
            setAnalysisStep('');
        }
    };
    
    const handleReset = () => {
        setFiles([]);
        setInsights([]);
        setError(null);
        setRecipientName('');
    };
    
    const removeFile = (fileToRemove: File) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };

    const handleInsightUpdate = (insight: Insight) => {
        setInsights(prevInsights => 
            prevInsights.map(i => i.id === insight.id ? insight : i)
        );
    };

    const handleSaveBulkUrls = async (urls: string[]) => {
        if (urls.length === 0) return;

        try {
            const updatedInsights = insights.map((insight, index) => {
                if (urls[index]) {
                    return { ...insight, full_report_url: urls[index].trim() };
                }
                return insight;
            });
            setInsights(updatedInsights);
            setIsUrlModalOpen(false);
        } catch (err) {
            console.error("Failed to save bulk URLs", err);
            setError("An error occurred while saving the URLs. Please try again.");
        }
    };

    const handleCopyAll = () => {
        // Collect all category visuals from all insights
        const allCategoryVisuals = insights.flatMap((insight, insightIndex) => 
            (insight.categoryVisuals || []).map((visual: any) => ({
                ...visual,
                insightIndex,
                companyName: insight.company_name
            }))
        );
        
        const allHtml = generateCombinedEmailBodyHTML(insights, recipientName, allCategoryVisuals);
        const allText = generateCombinedEmailBodyText(insights, recipientName);

        try {
            const clipboardItem = new ClipboardItem({
              'text/html': new Blob([allHtml], { type: 'text/html' }),
              'text/plain': new Blob([allText], { type: 'text/plain' }),
            });
      
            navigator.clipboard.write([clipboardItem]).then(() => {
                console.log(`Copied ${insights.length} reports to clipboard!`);
            });
        } catch(e) {
            console.error('Failed to copy all reports', e);
            setError('Could not copy reports. Your browser may not support this feature.');
        }
    };

    return (
        <div style={pageStyle}>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
            <div style={{ textAlign: 'center', color: 'white', marginBottom: '40px', padding: '20px 0' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    🎨 NetOp AI - Napkin Generator
                </h1>
                <p style={{ fontSize: '1.2rem', opacity: '0.9', fontWeight: '300' }}>
                    📊 AI-powered PDF analysis and report generation
                </p>
            </div>
            
            <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'rgba(255, 255, 255, 0.95)', borderRadius: '20px', padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}>
                <FileUpload 
                    onFileChange={handleFileChange} 
                    onAnalyze={handleAnalyze}
                    files={files}
                    removeFile={removeFile}
                    isLoading={isLoading}
                    disabled={isLoading || insights.length > 0}
                />

                {error && (
                    <div style={{
                        background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                        color: 'white',
                        padding: '16px',
                        borderRadius: '12px',
                        marginTop: '20px',
                        boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
                    }}>
                        <strong>⚠️ Error:</strong> {error}
                    </div>
                )}

                {isLoading && !insights.length && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '16px',
                        padding: '40px',
                        marginTop: '20px',
                        textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            border: '4px solid #e3f2fd',
                            borderTop: '4px solid #2196f3',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 20px'
                        }}></div>
                        
                        <h3 style={{
                            color: '#1976d2',
                            fontSize: '1.5rem',
                            fontWeight: '600',
                            marginBottom: '10px'
                        }}>
                            🔍 Analyzing PDF Content
                        </h3>
                        
                        <p style={{
                            color: '#666',
                            fontSize: '1rem',
                            marginBottom: '20px'
                        }}>
                            {analysisStep}
                        </p>
                        
                        <div style={{
                            width: '100%',
                            background: '#e3f2fd',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            marginBottom: '10px'
                        }}>
                            <div style={{
                                width: `${analysisProgress}%`,
                                height: '8px',
                                background: 'linear-gradient(90deg, #2196f3, #21cbf3)',
                                transition: 'width 0.3s ease',
                                borderRadius: '10px'
                            }}></div>
                        </div>
                        
                        <p style={{
                            color: '#2196f3',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                        }}>
                            {analysisProgress}% Complete
                        </p>
                    </div>
                )}

                {insights.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px',
                            marginBottom: '30px',
                            padding: '20px',
                            background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                            borderRadius: '12px',
                            border: '1px solid #dee2e6'
                        }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                               {insights.length > 1 && (
                                   <div style={{ display: 'flex', gap: '8px' }}>
                                       <input
                                           type="text"
                                           placeholder="Recipient name (optional)"
                                           value={recipientName}
                                           onChange={(e) => setRecipientName(e.target.value)}
                                           style={{
                                               padding: '12px 16px',
                                               border: '2px solid #e9ecef',
                                               borderRadius: '8px',
                                               fontSize: '14px',
                                               outline: 'none',
                                               transition: 'border-color 0.3s ease'
                                           }}
                                       />
                                       <button 
                                           style={{
                                               padding: '12px 20px',
                                               background: 'linear-gradient(135deg, #007bff, #0056b3)',
                                               color: 'white',
                                               border: 'none',
                                               borderRadius: '8px',
                                               fontSize: '14px',
                                               fontWeight: '600',
                                               cursor: 'pointer',
                                               transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                           }}
                                           onClick={() => setIsUrlModalOpen(true)}
                                       >
                                           📋 Add All Report URLs
                                       </button>
                                       <button 
                                           style={{
                                               padding: '12px 20px',
                                               background: 'linear-gradient(135deg, #28a745, #1e7e34)',
                                               color: 'white',
                                               border: 'none',
                                               borderRadius: '8px',
                                               fontSize: '14px',
                                               fontWeight: '600',
                                               cursor: 'pointer',
                                               transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                           }}
                                           onClick={handleCopyAll}
                                       >
                                           📄 Copy All ({insights.length}) Reports
                                       </button>
                                   </div>
                               )}
                            </div>
                            <button 
                                onClick={handleReset} 
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #6c757d, #545b62)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                               🔄 Start New Analysis
                            </button>
                        </div>

                        <BulkUrlModal
                            isOpen={isUrlModalOpen}
                            onClose={() => setIsUrlModalOpen(false)}
                            onSave={handleSaveBulkUrls}
                            reportCount={insights.length}
                            insights={insights}
                        />

                        {insights.map((insight) => (
                             <InsightReport 
                                 key={insight.id}
                                 insight={insight} 
                                 onUpdate={handleInsightUpdate}
                             />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
