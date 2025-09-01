import React, { useState } from 'react';

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
}

interface BulkUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (urls: string[]) => void;
  reportCount: number;
  insights: Insight[];
}

export default function BulkUrlModal({ isOpen, onClose, onSave, reportCount, insights }: BulkUrlModalProps) {
  const [urls, setUrls] = useState('');
  const [individualUrls, setIndividualUrls] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<'bulk' | 'individual'>('bulk');

  const handleBulkSave = () => {
    // Handle both newline-separated and space-separated URLs
    let urlList: string[] = [];
    
    // First try splitting by newlines
    const lineUrls = urls.split('\n').filter(url => url.trim() !== '');
    
    if (lineUrls.length === 1 && lineUrls[0].includes(' ')) {
      // If there's only one line but it contains spaces, split by spaces
      urlList = lineUrls[0].split(' ').filter(url => url.trim() !== '' && url.startsWith('http'));
    } else {
      // Otherwise use the line-separated URLs
      urlList = lineUrls;
    }
    
    onSave(urlList);
  };

  const handleIndividualSave = () => {
    // Convert individual URLs object to array in correct order
    const urlList = insights.map((insight, index) => individualUrls[index] || '');
    onSave(urlList);
  };

  // Calculate URL count for bulk mode
  const getUrlCount = () => {
    const lineUrls = urls.split('\n').filter(url => url.trim() !== '');
    
    if (lineUrls.length === 1 && lineUrls[0].includes(' ')) {
      return lineUrls[0].split(' ').filter(url => url.trim() !== '' && url.startsWith('http')).length;
    }
    return lineUrls.length;
  };

  const urlCount = getUrlCount();
  const individualUrlCount = Object.values(individualUrls).filter(url => url.trim() !== '').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add Report URLs</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        
        <p className="text-gray-600 mb-4">Choose how you want to add URLs to your reports</p>
        
        <div className="py-4">
          <div className="flex gap-2 mb-4">
            <button 
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setViewMode('bulk')}
            >
              Bulk Paste
            </button>
            <button 
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'individual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setViewMode('individual')}
            >
              Match Individually
            </button>
          </div>

          {viewMode === 'bulk' ? (
            <div>
              <textarea
                placeholder="https://...
https://...
https://...

OR paste all URLs separated by spaces:
https://... https://... https://..."
                className="w-full h-48 p-3 border border-gray-300 rounded-md"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  You have {reportCount} reports loaded. You have pasted {urlCount} URLs. 
                  {urlCount !== reportCount && (
                    <span className="text-orange-600 font-medium">
                      {" "}(Note: URL count doesn't match report count)
                    </span>
                  )}
                  <br/>
                  <strong>URLs will be assigned in order:</strong> First URL → First report, Second URL → Second report, etc.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {insights.map((insight, index) => (
                  <div key={insight.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{index + 1}. {insight.company_name}</div>
                      <div className="text-xs text-gray-500">
                        {insight.analysis_result.report_metadata.reporting_period_start} to {insight.analysis_result.report_metadata.reporting_period_end}
                      </div>
                    </div>
                    <span className="text-gray-400">→</span>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={individualUrls[index] || ''}
                      onChange={(e) => setIndividualUrls(prev => ({
                        ...prev,
                        [index]: e.target.value
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  {individualUrlCount} of {reportCount} reports have URLs assigned.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={viewMode === 'bulk' ? handleBulkSave : handleIndividualSave}
            disabled={viewMode === 'bulk' ? urlCount === 0 : individualUrlCount === 0}
            className={`px-4 py-2 rounded-md text-white ${
              viewMode === 'bulk' ? urlCount === 0 : individualUrlCount === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Save {viewMode === 'bulk' ? urlCount : individualUrlCount} URLs
          </button>
        </div>
      </div>
    </div>
  );
}
