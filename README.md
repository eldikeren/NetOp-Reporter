# 📊 NetOp Reporter - AI-Powered Network Analysis Engine

NetOp Reporter is an intelligent network infrastructure analysis tool that automatically processes network reports and provides actionable insights with beautiful visualizations. Built specifically for enterprise network operations teams.

## 🚀 Features

### 🔍 **Intelligent Analysis**
- **AI-Powered PDF Processing**: Automatically extracts network events from complex PDF reports
- **Multi-Category Analysis**: Interface issues, VPN tunnels, Wi-Fi problems, port errors, and more
- **Business Hours Impact**: Timezone-aware analysis of events during operational hours
- **Trend Detection**: Identifies improving, worsening, or stable trends across network events

### 🛫 **Signature Aviation Specialization**
- **Airport-Specific Analysis**: Automatically extracts IATA codes from site names
- **Timezone Intelligence**: Each airport site evaluated in its local timezone
- **Geographic Grouping**: Organizes findings by continent → country → city
- **Business Impact Dashboard**: Specialized metrics for aviation network operations

### 📈 **Advanced Visualizations**
- **Napkin.ai Integration**: Generates professional charts and diagrams
- **Multiple Chart Types**: Bar charts, trends, pie charts, and network diagrams
- **Custom Styling**: Professional, colorful, minimal, dark, and corporate themes
- **Real-time Generation**: Dynamic visualization creation based on analysis results

### 🎯 **Smart Recommendations**
- **Context-Aware Suggestions**: Tailored recommendations based on specific network issues
- **Modern Solutions**: SD-WAN, AI-driven monitoring, edge computing suggestions
- **Reasonable Tone**: Professional recommendations without panic-inducing language
- **Out-of-the-box Ideas**: Innovative approaches to common network challenges

## 🏗️ Architecture

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── AnalysisPage.tsx # Main analysis interface
│   │   └── App.tsx         # Application root
│   └── package.json
│
├── server/                 # Node.js backend API
│   ├── index.js           # Main server file
│   ├── airportsIndex.js   # Airport data management
│   ├── extractAirportsFromPdf.js # IATA code extraction
│   ├── businessHours.js   # Timezone calculations
│   ├── signature.controller.js # Signature Aviation endpoints
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

### Airport Detection
The system automatically detects airports from site names like:
- `SFS-ATL` → Atlanta Hartsfield-Jackson International
- `SFS-LAX` → Los Angeles International
- `SFS-LHR` → London Heathrow

### Business Hours Analysis
- **Timezone Awareness**: Each airport evaluated in local time
- **Business Impact**: Events flagged if they occurred during 09:00-18:00 local time
- **Geographic Insights**: Results grouped by continent → country → city

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
    "business_hours_percentage": 32
  }
}
```

## 🔧 Event Analysis Capabilities

### Wi-Fi Issues
- **Error Types**: Association, authentication, DHCP, roaming
- **Impact Metrics**: Number of errors and affected clients
- **Format**: "Site AP experienced authentication errors (150 errors affecting 45 clients)"

### Port Errors
- **Error Rates**: Input/output traffic error percentages
- **Error Types**: CRC, alignment, runts, giants
- **Format**: "Site interface experienced 2.5% error rate (CRC errors on input traffic)"

### Service Performance
- **SLA Correlation**: Matches events with SLA data
- **Application Identification**: Google, Office 365, Salesforce, etc.
- **Format**: "Site experienced performance issues with Office 365"

## 🎨 Visualization Styles

- **Professional**: Clean business charts
- **Colorful**: Vibrant multi-color themes
- **Minimal**: Simple, clean designs
- **Dark**: High contrast dark themes
- **Corporate**: Branded color schemes

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
- **React & Node.js**: For the robust application framework

---

**NetOp Reporter** - Making network analysis intelligent, actionable, and beautiful. 🚀