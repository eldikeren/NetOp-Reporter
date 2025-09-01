import React, { useState, useEffect } from 'react';
import { generateEmailBodyHTML, generateEmailBodyText } from './emailUtils';
import ReportVisuals from './ReportVisuals';

interface Insight {
  id: string;
  company_name: string;
  original_file_name: string;
  full_report_url?: string;
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
          business_hours_impact?: string;
        }>;
    }>;
    recommendations: string[];
    business_hours_analysis?: {
      peak_incident_hours?: string;
      no_change_window?: string;
      backup_window?: string;
      total_events?: number;
      business_hours_events?: number;
      business_hours_percentage?: number;
      business_hours_events_list?: Array<{
        event_description: string;
        business_impact: string;
        occurrence_time: string;
        duration_minutes: number;
        severity: string;
      }>;
    };
    enhanced_insights?: {
      timezone_analysis?: string;
      maintenance_recommendations?: string;
      peak_hours_analysis?: string;
      business_impact_assessment?: string;
      root_cause_patterns?: string;
    };
  };
}

interface CategoryVariation {
  categoryName: string;
  variations: Array<{
    id: number;
    chartType: string;
    style: string;
    imageUrl: string;
    prompt: string;
  }>;
  selectedVariation: number;
}

export default function InsightReport({ insight, onUpdate }: { insight: Insight; onUpdate: (insight: Insight) => void }) {
  const { analysis_result, company_name } = insight;
  const { categories, report_metadata, recommendations } = analysis_result || {};
  const { humanized_intro, reporting_period_start, reporting_period_end } = report_metadata || {};
  const improvements = categories?.flatMap(c => c.findings).filter(f => f.trend === 'improving_trend') || [];
  
  const [isSaving, setIsSaving] = useState(false);
  const [url, setUrl] = useState(insight.full_report_url || '');
  const [recipientName, setRecipientName] = useState('');
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [categoryVariations, setCategoryVariations] = useState<CategoryVariation[]>([]);
  const [selectedView, setSelectedView] = useState<'visuals' | 'email'>('email');

  useEffect(() => {
    setUrl(insight.full_report_url || '');
  }, [insight.full_report_url]);

  const handleGenerateVisuals = async () => {
    setIsGeneratingVisuals(true);
    setGenerationProgress(0);
    setCategoryVariations([]);

    try {
      const totalCategories = categories?.length || 0;
      let completedCategories = 0;
      const newCategoryVariations: CategoryVariation[] = [];
      let rateLimitHit = false;

      for (const category of categories || []) {
        if (rateLimitHit) {
          // If rate limit was hit, create placeholder variations
          newCategoryVariations.push({
            categoryName: category.category_name,
            variations: [{
              id: 0,
              chartType: 'bar',
              style: 'professional',
              imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5hcGtpbiBBSSBSYXRlIExpbWl0ZWQ8L3RleHQ+PC9zdmc+',
              prompt: 'Rate limit exceeded - placeholder visualization'
            }],
            selectedVariation: 0
          });
        } else {
          const variations = await generateVariationsForCategory(category);
          if (variations.length === 0) {
            rateLimitHit = true;
            // Create placeholder for this category too
            newCategoryVariations.push({
              categoryName: category.category_name,
              variations: [{
                id: 0,
                chartType: 'bar',
                style: 'professional',
                imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5hcGtpbiBBSSBSYXRlIExpbWl0ZWQ8L3RleHQ+PC9zdmc+',
                prompt: 'Rate limit exceeded - placeholder visualization'
              }],
              selectedVariation: 0
            });
          } else {
            newCategoryVariations.push({
              categoryName: category.category_name,
              variations,
              selectedVariation: 0
            });
          }
        }
        
        completedCategories++;
        setGenerationProgress((completedCategories / totalCategories) * 100);
        setCategoryVariations([...newCategoryVariations]);
      }

      if (rateLimitHit) {
        alert('Napkin AI rate limit reached or API not configured. Some visualizations are placeholders. Please check your Napkin API configuration or try again later for full visualizations.');
      } else {
        alert(`Generated ${totalCategories} visual variations successfully!`);
      }
    } catch (error) {
      console.error('Error generating visuals:', error);
      alert('Failed to generate visual variations. Please try again.');
    } finally {
      setIsGeneratingVisuals(false);
      setGenerationProgress(0);
    }
  };

  const generateVariationsForCategory = async (category: any) => {
    // Temporarily disable image generation to prevent connection errors
    console.log('Image generation temporarily disabled to prevent connection errors');
    return [];
    const variations = [];

    try {
      // Generate only 1 highly relevant visualization per category
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
      
      // Create a comprehensive prompt that includes all findings for better relevance
      const findingsSummary = category.findings?.map((f: any, index: number) => 
        `${index + 1}. ${f.summary_line} (${f.total_occurrences} occurrences, ${f.avg_duration_minutes}min avg duration)`
      ).join('\n') || '';

      const prompt = `Create a comprehensive bar chart visualization for ${category.category_name} that shows:

${findingsSummary}

Focus on:
- Most critical issues and their impact
- Trends and patterns across all findings  
- Business impact and severity levels
- Clear visual representation of the data

Use professional style with clear visual elements to represent the data professionally.
          
Please create a bar chart visualization for this data.`;

      const response = await fetch('http://localhost:3001/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: 'professional',
          chartType: 'bar',
          dataText: findingsSummary
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Generated image for ${category.category_name}:`, result);
        
        if (result.success && result.imageUrl) {
          variations.push({
            id: 0,
            chartType: 'bar',
            style: 'professional',
            imageUrl: result.imageUrl,
            prompt
          });
          console.log(`Successfully added variation for ${category.category_name}`);
        } else {
          console.error(`No valid image URL in response for ${category.category_name}:`, result);
        }
      } else if (response.status === 429) {
        console.error(`Rate limit exceeded for ${category.category_name}. Skipping.`);
      } else if (response.status === 403) {
        console.error(`Napkin API authentication failed for ${category.category_name}. Skipping.`);
      } else {
        console.error(`Failed to generate visualization for ${category.category_name}:`, response.status);
      }
    } catch (error) {
      console.error(`Error generating visualization for ${category.category_name}:`, error);
    }

    return variations;
  };

  const handleVariationSelect = (categoryIndex: number, variationIndex: number) => {
    setCategoryVariations(prev => prev.map((cat, idx) => 
      idx === categoryIndex ? { ...cat, selectedVariation: variationIndex } : cat
    ));
  };

  const handleSaveUrl = async () => {
    setIsSaving(true);
    try {
      const updatedInsight = { ...insight, full_report_url: url };
      onUpdate(updatedInsight);
      alert('Report URL saved successfully!');
    } catch (error) {
      console.error('Error saving URL:', error);
      alert('Failed to save URL. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const emailText = generateEmailBodyText(insight, url || '', recipientName || '');
      const emailHTML = generateEmailBodyHTML(insight, url || '', recipientName || '', categoryVariations);
      
      // Create a rich text format for clipboard
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([emailHTML || ''], { type: 'text/html' }),
        'text/plain': new Blob([emailText || ''], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
      alert('Report copied to clipboard! You can now paste it into your email client.');
    } catch (error) {
      console.error('Clipboard API not supported or failed:', error);
      // Fallback for browsers that don't support Clipboard API
      const emailText = generateEmailBodyText(insight, url || '', recipientName || '');
      const textArea = document.createElement('textarea');
      textArea.value = emailText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Report copied to clipboard! You can now paste it into your email client.');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'major_issue': return '🔴';
      case 'recurring_issue': return '🟠';
      case 'notable': return '🔵';
      default: return '⚪';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'worsening_trend': return '↗️';
      case 'improving_trend': return '↘️';
      case 'stable_trend': return '➡️';
      default: return '❔';
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('vpn')) return '🛡️';
    if (name.includes('wifi') || name.includes('wlan')) return '📶';
    if (name.includes('client') || name.includes('connected')) return '👥';
    if (name.includes('interface') || name.includes('port')) return '🔌';
    if (name.includes('service') || name.includes('sla')) return '🌐';
    return '📊';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                📄
              </div>
              <div>
                <h1 className="text-3xl font-bold">{company_name}</h1>
                <p className="text-blue-100 text-lg">Network Analysis Report</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-blue-100 text-sm font-medium mb-1">📅 Reporting Period</div>
                <p className="text-white font-semibold">{reporting_period_start} - {reporting_period_end}</p>
              </div>
              
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-blue-100 text-sm font-medium mb-1">📊 Categories Analyzed</div>
                <p className="text-white font-semibold">{categories?.length || 0} Network Areas</p>
              </div>
              
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-blue-100 text-sm font-medium mb-1">📈 Improvements</div>
                <p className="text-white font-semibold">{improvements.length} Areas Improving</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated Action Buttons */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => setSelectedView('visuals')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedView === 'visuals'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            🎨 AI Visualizations
          </button>
          
          <button
            onClick={() => setSelectedView('email')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedView === 'email'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            📧 Email Report
          </button>
          
          <button
            onClick={handleGenerateVisuals}
            disabled={isGeneratingVisuals}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingVisuals ? (
              <>
                ⏳ Generating... {Math.round(generationProgress)}%
              </>
            ) : (
              <>
                ⚡ Generate AI Visuals
              </>
            )}
          </button>
          
          <button
            onClick={handleCopyToClipboard}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            📋 Copy to Email
          </button>
        </div>
      </div>

      {/* Content Sections */}
      <div className="p-6">

        {selectedView === 'visuals' && (
          <div className="space-y-6">
            {categoryVariations.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No AI Visualizations Yet</h3>
                <p className="text-gray-600 mb-6">
                  Generate stunning AI-powered visualizations for each category to enhance your report.
                </p>
                <button
                  onClick={handleGenerateVisuals}
                  disabled={isGeneratingVisuals}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg px-6 py-3 font-medium"
                >
                  {isGeneratingVisuals ? (
                    <>
                      ⏳ Generating...
                    </>
                  ) : (
                    <>
                      ⚡ Generate AI Visuals
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {categoryVariations.map((category: CategoryVariation, categoryIndex: number) => (
                  <div key={categoryIndex} className="bg-white border border-gray-200 rounded-lg">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                        {getCategoryIcon(category.categoryName)}
                        {category.categoryName} - AI Visualizations
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        Select your preferred visualization style for this category
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {category.variations.map((variation: any, variationIndex: number) => (
                          <div
                            key={variationIndex}
                            className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                              category.selectedVariation === variationIndex
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handleVariationSelect(categoryIndex, variationIndex)}
                          >
                            {category.selectedVariation === variationIndex && (
                              <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                ✓
                              </div>
                            )}
                            
                            <div className="p-3">
                              <img
                                src={variation.imageUrl}
                                alt={`${variation.chartType} chart - ${variation.style} style`}
                                className="w-full h-32 object-cover rounded-md mb-2"
                              />
                              <div className="text-center">
                                <p className="text-sm font-medium text-gray-900 capitalize">
                                  {variation.chartType} Chart
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {variation.style} Style
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Selected Visualization:</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="capitalize">
                            {category.variations[category.selectedVariation]?.chartType} Chart
                          </span>
                          <span>•</span>
                          <span className="capitalize">
                            {category.variations[category.selectedVariation]?.style} Style
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedView === 'email' && (
          <div className="space-y-6">
            {/* Email Configuration */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                ⚙️ Email Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Full Report URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button
                      onClick={handleSaveUrl}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                    >
                      {isSaving ? '⏳' : '💾'}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Recipient Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter recipient name for personalization"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Email Preview */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📧 Email Preview (This is exactly what will be copied)
                </h3>
              </div>
              <div className="p-6">
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: generateEmailBodyHTML(insight, url || '', recipientName || '', categoryVariations) || '' 
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
