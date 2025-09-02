# 📊 NetOp Reporter - AI-Powered Network Analysis Engine

NetOp Reporter is an intelligent network infrastructure analysis tool that automatically processes network reports and provides actionable insights with beautiful visualizations. Built specifically for enterprise network operations teams with specialized support for aviation and multi-location organizations.

## 🚀 Features

### 🔍 **Intelligent Analysis**
- **AI-Powered PDF Processing**: Automatically extracts network events from complex PDF reports
- **Multi-Category Analysis**: Interface issues, VPN tunnels, Wi-Fi problems, port errors, and more
- **Business Hours Impact**: Timezone-aware analysis of events during operational hours (09:00-18:00, Mon-Fri)
- **Trend Detection**: Identifies improving, worsening, or stable trends across network events
- **Robust JSON Parsing**: Advanced error handling and auto-correction for AI-generated responses
- **Executive Summary Generation**: AI-powered executive summaries with real data examples
- **Structured Recommendations**: Three-tier recommendation framework (Stability, Capacity, Observability)

### 🛫 **Signature Aviation Specialization**
- **Airport-Specific Analysis**: Automatically extracts IATA codes from site names (e.g., SFS-ATL, SFS-LAX)
- **Timezone Intelligence**: Each airport site evaluated in its local timezone using Luxon
- **Geographic Grouping**: Organizes findings by continent → country → city hierarchy
- **Business Impact Dashboard**: Specialized KPI dashboard with Airport Operations Priority Index (AOPI)
- **IATA Code Lookup**: Real-time airport data via API Ninjas with caching and rate limiting
- **OurAirports Integration**: Comprehensive airport database with timezone information
- **Dynamic Category Detection**: Only includes categories that actually exist in the PDF
- **Business Hours Conversion**: All timestamps converted from UTC to airport local time

### 🌍 **AVI-SPL Multi-Global Location Support**
- **City-Based Site Analysis**: Extracts city names from site names (e.g., "Chicago", "London", "Dubai")
- **Global Timezone Conversion**: Converts UTC timestamps to local time zones for each city
- **Enhanced City Matching**: Comprehensive city-to-timezone mapping with fallback handling
- **Business Hours Impact**: Determines if events occurred during business hours (09:00-18:00, Mon-Fri)
- **Specialized Notes**: AVI-SPL-specific notes about UTC to local time conversion
- **Flexible Site Handling**: Supports various site naming conventions and datacenter locations

### 📈 **Advanced Visualizations**
- **Napkin.ai Integration**: Generates professional charts and diagrams
- **Multiple Chart Types**: Bar charts, trends, pie charts, and network diagrams
- **Custom Styling**: Professional, colorful, minimal, dark, and corporate themes
- **Real-time Generation**: Dynamic visualization creation based on analysis results
- **Rate Limiting**: Intelligent handling of API rate limits with retry mechanisms
- **Error Recovery**: Graceful fallback when visualization generation fails

### 🎯 **Smart Recommendations Framework**
- **Stability Enhancements**: Addresses current reliability issues (interface down, Wi-Fi auth, port errors)
- **Capacity & Resilience**: Prepares for future demand (client load, congestion, utilization)
- **Professional Tone**: Avoids "critical", "immediately", "urgent" - uses advisory language
- **Actionable Insights**: "Review X could help", "Optimizing Y may improve", "Enhancing Z would provide"
- **Deduplication**: Automatic removal of duplicate recommendations
- **Context-Aware**: Recommendations based on actual data patterns and trends

### 📊 **Enhanced Report Features**
- **Dynamic Report Titles**: Customer name + "Network Analysis Report" format
- **Date Range Generation**: Automatic 7-day reporting period calculation
- **Event Limiting**: Maximum 3 events per category for focused reporting
- **Device Alerting Removal**: Automatically excludes "Device Alerting" category from all reports
- **Business Hours Display**: Shows "Business Hours Events" and "Non-Business Hours Events" counts
- **Conditional Sections**: Removes Business Hours Impact section when no timestamped events exist

## 🏗️ Architecture

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── analysis/   # Analysis-specific components
│   │   │   │   ├── InsightReport.tsx # Main report display
│   │   │   │   ├── ReportVisuals.tsx # Visualization components
│   │   │   │   └── emailUtils.ts # Email generation utilities
│   │   │   └── FileUpload.tsx # File upload component
│   │   ├── AnalysisPage.tsx # Main analysis interface
│   │   └── App.tsx         # Application root
│   └── package.json
│
├── server/                 # Node.js backend API
│   ├── index.js           # Main server file with analysis logic
│   ├── signatureAviationHandler.js # Signature Aviation processing
│   ├── avisplHandler.js   # AVI-SPL multi-location processing
│   ├── cityMatcher.js     # Enhanced city-to-timezone matching
│   ├── iataClient.js      # IATA code lookup client
│   ├── devCache.js        # In-memory caching for development
│   ├── pdfProcessor.js    # PDF text extraction and processing
│   └── package.json
│
└── docs/                  # Documentation
    ├── NETWORK_ANALYSIS_GUIDE.md
    └── USAGE_GUIDE.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- OpenAI API key
- Napkin.ai API key (optional)
- API Ninjas key (for IATA lookups)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/eldikeren/NetOp-Reporter.git
   cd NetOp-Reporter
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # In server directory, copy the example env file
   cd ../server
   cp env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   NAPKIN_API_TOKEN=your_napkin_api_token_here
   API_NINJAS_KEY=your_api_ninjas_key_here
   PORT=6000
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm start
   # Server runs on http://localhost:6000
   ```

2. **Start the frontend (in a new terminal)**
   ```bash
   cd client
   npm start
   # Client runs on http://localhost:3000
   ```

3. **Access the application**
   Open your browser to `http://localhost:3000`

## 📊 API Endpoints

### Standard Analysis
- `POST /api/analyze` - Analyze network PDF reports
- `POST /api/generate-image` - Generate visualizations
- `GET /api/styles` - Get available chart styles
- `GET /health` - Health check

### Signature Aviation Endpoints
- `POST /api/signature/airports` - Extract airports from PDF
- `POST /api/signature/airports-with-events` - Combined airport + event analysis
- `POST /api/signature/business-hours` - Business hours impact analysis

## 🛫 Signature Aviation Features

### Airport Detection & Processing
The system automatically detects airports from site names like:
- `SFS-ATL` → Atlanta Hartsfield-Jackson International
- `SFS-LAX` → Los Angeles International
- `SFS-LHR` → London Heathrow
- `SFS-DXB` → Dubai International

### Advanced Timezone Handling
- **Luxon Integration**: Robust timezone conversion using Luxon library
- **IATA Code Lookup**: Real-time airport data via API Ninjas
- **Caching System**: In-memory caching for development efficiency
- **Rate Limiting**: Intelligent API call management with retry logic
- **Fallback Handling**: Graceful degradation when API calls fail

### Business Hours Analysis
- **Timezone Awareness**: Each airport evaluated in local time
- **Business Impact**: Events flagged if they occurred during 09:00-18:00 local time (Mon-Fri)
- **Geographic Insights**: Results grouped by continent → country → city
- **KPI Dashboard**: Airport Operations Priority Index (AOPI) with tier breakdown

### Example Response
```json
{
  "customer": "Signature Aviation",
  "airports_count": 12,
  "grouped": {
    "NA": {
      "US": [
        {"iata": "ATL", "name": "Hartsfield–Jackson Atlanta International", "city": "Atlanta", "timezone": "America/New_York"}
      ]
    }
  },
  "business_hours_analysis": {
    "total_events": 25,
    "business_hours_events": 8,
    "business_hours_percentage": 32,
    "no_business_hours_events": 17
  },
  "kpi_dashboard": {
    "total_airports_with_issues": 8,
    "airports_affected_during_business_hours": 3,
    "aopi_score": 0.75
  }
}
```

## 🌍 AVI-SPL Multi-Global Location Features

### City-Based Site Analysis
Automatically extracts and processes city names from site names:
- `Chicago Warehouse` → Chicago, US (America/Chicago)
- `London Office` → London, UK (Europe/London)
- `Dubai HQ` → Dubai, UAE (Asia/Dubai)
- `Washington DC` → Washington, US (America/New_York)

### Enhanced City Matching
- **Comprehensive Database**: 200+ cities with timezone mapping
- **Flexible Matching**: Handles various naming conventions
- **Fallback Logic**: Graceful handling of unmatched cities
- **Datacenter Support**: Special handling for generic datacenter names

### Business Hours Impact Analysis
- **UTC to Local Conversion**: All timestamps converted to city local time
- **Business Hours Logic**: Monday-Friday, 09:00-18:00 local time
- **Event Counting**: Separate counts for business and non-business hours
- **Specialized Notes**: AVI-SPL-specific notes about timezone conversion

### Example Processing
```
Input: "Chicago Warehouse" with UTC timestamp "08/29/2025 15:51"
Output: 
- City: Chicago, US
- Timezone: America/Chicago
- Local Time: 08/29/2025 10:51
- Business Hours: YES (10:51 AM is during business hours)
```

## 🔧 Event Analysis Capabilities

### Wi-Fi Issues
- **Error Types**: Association, authentication, DHCP, roaming
- **Impact Metrics**: Number of errors and affected clients
- **Device Names**: Access Point (AP) names included in summaries
- **Highest Error Rate**: Identifies devices with most errors
- **Format**: "Site AP North_907 experienced 150 authentication errors affecting 45 clients"

### Port Errors
- **Error Rates**: Input/output traffic error percentages from MAX columns
- **Error Types**: CRC, alignment, runts, giants
- **Accurate Percentages**: Uses exact values from tables, not trends
- **Format**: "Site interface experienced 2.5% error rate (CRC errors on input traffic)"

### Service Performance
- **SLA Correlation**: Matches events with SLA data when tables exist
- **Application Identification**: Google, Office 365, Salesforce, etc.
- **Conditional Display**: Only shows if Service Performance table exists in PDF
- **Format**: "Site experienced performance issues with Office 365"

### Connected Clients
- **Trend Analysis**: Percentage change over reporting period
- **Severity Classification**: Major if deviation ≥ 20%, Minor if < 20%
- **Format**: "Site experienced 24% increase in connected clients"
- **Language**: Uses "with maximum connected clients" instead of "with a peak"

### Interface Down Events
- **Timestamp Handling**: Correctly identifies events without timestamps
- **Business Hours**: Set to "NO" for events without time components
- **Format**: "Interface as1-arva2001-w180610xDP experienced 87 occurrences"

## 🎨 Visualization Styles

- **Professional**: Clean business charts
- **Colorful**: Vibrant multi-color themes
- **Minimal**: Simple, clean designs
- **Dark**: High contrast dark themes
- **Corporate**: Branded color schemes

## 📊 Report Summary Rules

### Business Hours Impact
- **Conditional Display**: Removed entirely if no timestamped events exist
- **Count Display**: Shows "Business Hours Events" and "Non-Business Hours Events" counts
- **No Zeros**: Never displays 0% or 0 events

### Event Categorization
- **Interface Down Events**: List interfaces clearly, consistent formatting
- **Connected Clients**: Show trend percentage, Major if ≥ 20% deviation
- **Wi-Fi Issues**: Include AP/Device names, highest error count, impacted clients
- **Severity Labels**: Major only for Connected Clients ≥ 20% OR highest Wi-Fi errors

### Executive Summary
- **Professional Tone**: Clear, humanized, no marketing fluff
- **Real Examples**: Includes actual data examples (highest Wi-Fi errors, client trends)
- **Unique Content**: Varies phrasing and structure each time
- **Root Cause Focus**: Emphasizes underlying causes over symptoms

## 🔧 Technical Features

### Robust Error Handling
- **JSON Parsing**: Advanced retry logic with auto-correction for common errors
- **API Resilience**: Rate limiting, retry mechanisms, graceful degradation
- **Server Stability**: Crash handlers, increased body limits, timeout management
- **Nodemon Configuration**: Ignores cache/uploads directories to prevent restarts

### Performance Optimizations
- **Chunked Processing**: Large PDFs processed in manageable chunks
- **Caching Strategy**: In-memory caching for development efficiency
- **Rate Limiting**: Intelligent API call management
- **Memory Management**: Base64 image size caps for safety

### Development Features
- **Debug Logging**: Comprehensive logging for troubleshooting
- **Hot Reloading**: Nodemon configuration for development efficiency
- **Error Recovery**: Graceful handling of various failure scenarios
- **Testing Support**: Health check endpoints and status monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: Report bugs via GitHub Issues
- **Questions**: Open a discussion for general questions

## 🙏 Acknowledgments

- **OpenAI**: For GPT-4 powered analysis capabilities
- **Napkin.ai**: For beautiful visualization generation
- **OurAirports**: For comprehensive airport data
- **API Ninjas**: For real-time IATA code lookups
- **Luxon**: For advanced timezone handling
- **React & Node.js**: For the robust application framework

---

**NetOp Reporter** - Making network analysis intelligent, actionable, and beautiful. 🚀