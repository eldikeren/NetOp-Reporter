import React, { useState, useEffect } from 'react';
import AnalysisPage from './AnalysisPage';

interface ImageResponse {
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
}

interface ApiError {
  error: string;
  details?: string;
}

interface StyleResponse {
  styles: Record<string, string>;
  chartTypes: Record<string, string>;
  defaultStyle: string;
  defaultChartType: string;
}

const samplePrompts = [
  "Network diagram showing firewalls, routers, and switches",
  "Heatmap of server outages by region",
  "Dashboard-style visualization of network traffic",
  "Architecture diagram of a microservices system",
  "Data flow diagram for an e-commerce platform",
  "System monitoring dashboard with graphs and alerts",
  "User journey map for mobile app onboarding",
  "Process flow chart for order fulfillment",
  "Organizational chart for a tech company",
  "Timeline visualization of project milestones"
];

const sampleDataPrompts = [
  {
    data: "ARVA1900 - 1900 Crystal Dr - Arlington VA - experienced 3 site-wide unreachable over the past week, totaling 172.1 minutes of downtime, with an average of 57.3 minutes per occurrence",
    prompt: "Create a chart showing downtime incidents and their duration"
  },
  {
    data: "Q1: $2.3M revenue, Q2: $3.1M revenue, Q3: $2.8M revenue, Q4: $4.2M revenue",
    prompt: "Show quarterly revenue trends over the year"
  },
  {
    data: "CPU usage: 45%, Memory: 78%, Disk: 23%, Network: 12%",
    prompt: "Create a system resource utilization dashboard"
  },
  {
    data: "North Region: 15 outages, South Region: 8 outages, East Region: 12 outages, West Region: 6 outages",
    prompt: "Compare outage frequency across regions"
  }
];

function App() {
  const [currentView, setCurrentView] = useState<'napkin' | 'analysis'>('napkin');
  const [prompt, setPrompt] = useState('');
  const [dataText, setDataText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('colorful');
  const [selectedChartType, setSelectedChartType] = useState('auto');
  const [availableStyles, setAvailableStyles] = useState<Record<string, string>>({});
  const [availableChartTypes, setAvailableChartTypes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);

  // Load available styles on component mount
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/styles');
        if (response.ok) {
          const data: StyleResponse = await response.json();
          setAvailableStyles(data.styles);
          setAvailableChartTypes(data.chartTypes);
          
          // Load saved preferences from localStorage
          const savedStyle = localStorage.getItem('napkin-preferred-style');
          const savedChartType = localStorage.getItem('napkin-preferred-chart-type');
          
          if (savedStyle && data.styles[savedStyle]) {
            setSelectedStyle(savedStyle);
          }
          if (savedChartType && data.chartTypes[savedChartType]) {
            setSelectedChartType(savedChartType);
          }
        }
      } catch (error) {
        console.error('Failed to load styles:', error);
      }
    };
    
    loadStyles();
  }, []);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setRevisedPrompt(null);

    try {
      const response = await fetch('http://localhost:3001/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: '1024x1024',
          style: selectedStyle,
          chartType: selectedChartType,
          dataText: dataText.trim()
        }),
      });

      const data: ImageResponse | ApiError = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const imageData = data as ImageResponse;
      
      if (imageData.data && imageData.data.length > 0) {
        setGeneratedImage(imageData.data[0].url);
        if (imageData.data[0].revised_prompt) {
          setRevisedPrompt(imageData.data[0].revised_prompt);
        }
      } else {
        throw new Error('No image data received');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (samplePrompt: string) => {
    setPrompt(samplePrompt);
    setError(null);
  };

  const handleDataPromptClick = (sampleDataPrompt: { data: string; prompt: string }) => {
    setDataText(sampleDataPrompt.data);
    setPrompt(sampleDataPrompt.prompt);
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      generateImage();
    }
  };

  const handleStyleChange = (style: string) => {
    setSelectedStyle(style);
    // Save preference to localStorage for persistence
    localStorage.setItem('napkin-preferred-style', style);
  };

  const handleChartTypeChange = (chartType: string) => {
    setSelectedChartType(chartType);
    // Save preference to localStorage for persistence
    localStorage.setItem('napkin-preferred-chart-type', chartType);
  };

  const renderNapkinView = () => (
    <div className="container">
      <h1 className="title">🎨 NetOp AI - Napkin Image Generator</h1>
      <p className="subtitle">Transform your ideas into stunning visualizations with AI</p>
      
      <div className="card">
        <div className="form-group">
          <label htmlFor="dataText" className="label">
            📊 Data to Visualize (Optional):
          </label>
          <textarea
            id="dataText"
            className="textarea"
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
            placeholder="Paste your data here (e.g., ARVA1900 - 1900 Crystal Dr - Arlington VA - experienced 3 site-wide unreachable over the past week, totaling 172.1 minutes of downtime, with an average of 57.3 minutes per occurrence)..."
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="prompt" className="label">
            🎯 Visualization Request:
          </label>
          <textarea
            id="prompt"
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Describe how you want to visualize the data (e.g., Create a chart showing downtime incidents, Create a timeline of outages, Show the relationship between downtime duration and frequency)..."
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label className="label">
            📈 Chart Type:
          </label>
          <div className="style-selector">
            {availableChartTypes && Object.entries(availableChartTypes).map(([chartKey, description]) => (
              <button
                key={chartKey}
                className={`style-option ${selectedChartType === chartKey ? 'selected' : ''}`}
                onClick={() => handleChartTypeChange(chartKey)}
                disabled={isLoading}
                title={description}
              >
                <span className="style-name">{chartKey}</span>
                <span className="style-description">{description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="label">
            🎨 Visual Style:
          </label>
          <div className="style-selector">
            {availableStyles && Object.entries(availableStyles).map(([styleKey, description]) => (
              <button
                key={styleKey}
                className={`style-option ${selectedStyle === styleKey ? 'selected' : ''}`}
                onClick={() => handleStyleChange(styleKey)}
                disabled={isLoading}
                title={description}
              >
                <span className="style-name">{styleKey}</span>
                <span className="style-description">{description}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="button"
          onClick={generateImage}
          disabled={isLoading || !prompt.trim()}
        >
          {isLoading ? '🔄 Generating...' : '✨ Generate Image'}
        </button>

        <div className="sample-prompts">
          <h3>💡 Try these sample prompts:</h3>
          <div>
            {samplePrompts.map((samplePrompt, index) => (
              <button
                key={index}
                className="prompt-button"
                onClick={() => handlePromptClick(samplePrompt)}
                disabled={isLoading}
              >
                {samplePrompt}
              </button>
            ))}
          </div>
        </div>

        <div className="sample-prompts">
          <h3>📊 Try these data-driven examples:</h3>
          <div>
            {sampleDataPrompts.map((sampleDataPrompt, index) => (
              <button
                key={index}
                className="prompt-button data-prompt"
                onClick={() => handleDataPromptClick(sampleDataPrompt)}
                disabled={isLoading}
              >
                <div className="data-prompt-title">{sampleDataPrompt.prompt}</div>
                <div className="data-prompt-data">{sampleDataPrompt.data.substring(0, 60)}...</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">
            <div>🔄 Generating your image...</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
              This may take a few moments
            </div>
          </div>
        )}

        {generatedImage && (
          <div className="image-container">
            <h3>🎉 Your Generated Image</h3>
            <img
              src={generatedImage}
              alt="Generated visualization"
              className="generated-image"
            />
            <div className="image-info">
              <div><strong>Chart Type:</strong> {selectedChartType} - {availableChartTypes[selectedChartType]}</div>
              <div><strong>Style:</strong> {selectedStyle} - {availableStyles[selectedStyle]}</div>
              {dataText && (
                <div><strong>Data:</strong> {dataText.substring(0, 100)}{dataText.length > 100 ? '...' : ''}</div>
              )}
              {revisedPrompt && (
                <div><strong>Revised prompt:</strong> {revisedPrompt}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalysisView = () => (
    <div className="container">
      <h1 className="title">📊 NetOp AI - Network Analysis Engine</h1>
      <p className="subtitle">AI-powered PDF analysis and report generation</p>
      <AnalysisPage />
    </div>
  );

  return (
    <div>
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-8 py-4">
            <button
              onClick={() => setCurrentView('napkin')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                currentView === 'napkin'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              🎨 NetOp AI - Napkin Generator
            </button>
            <button
              onClick={() => setCurrentView('analysis')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                currentView === 'analysis'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📊 NetOp AI - Network Analysis
            </button>
          </div>
        </div>
      </div>
      
      {currentView === 'napkin' ? renderNapkinView() : renderAnalysisView()}
    </div>
  );
}

export default App;
