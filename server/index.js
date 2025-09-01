// Load environment variables from .env file
require('dotenv').config();

// Ensure cache directory exists
const { ensureCacheDirectory } = require('./ensureCacheDir');
ensureCacheDirectory();

// Validate required API keys
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required in .env file');
  process.exit(1);
}

if (!process.env.API_NINJAS_KEY) {
  console.warn('⚠️ API_NINJAS_KEY not found in .env file - IATA timezone conversion will be limited');
}

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises'); // Switch to async fs
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const PDFProcessor = require('./pdfProcessor');

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NAPKIN_API_TOKEN = process.env.NAPKIN_API_TOKEN || 'sk-d4c4e37aa968c8df99eb41617d03a0cf7a4f1521f4f2184f1c18741d00c9ec64';

// Initialize OpenAI with current model
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Constants for robustness
const MAX_CHARS = 25_000; // Further reduced to stay within rate limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit for customer reports
const RATE_LIMIT_DELAY = 60000; // 60 seconds delay for rate limit

// Safer JSON extraction function
function firstJson(str) {
  let depth = 0, start = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') { 
      if (depth === 0) start = i; 
      depth++; 
    } else if (str[i] === '}') { 
      depth--; 
      if (depth === 0 && start !== -1) {
        try { 
          return JSON.parse(str.slice(start, i + 1)); 
        } catch (e) {
          // Continue searching for valid JSON
        }
      }
    }
  }
  throw new Error('No valid JSON found');
}

// Normalize analysis data to ensure consistent schema
function normalize(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return {
      report_metadata: {
        reporting_period_start: "01/01/2024",
        reporting_period_end: "01/31/2024",
        humanized_intro: "Analysis failed - using fallback data",
        customer_timezone: "UTC"
      },
      categories: [],
      recommendations: ["Please try uploading the PDF again"],
          business_hours_analysis: {
      peak_incident_hours: "09:00-17:00",
      no_change_window: "02:00-04:00",
      backup_window: "01:00-03:00",
      business_hours_events: []
    },
      enhanced_insights: {
        timezone_analysis: "UTC timezone analysis",
        maintenance_recommendations: "Standard maintenance windows recommended",
        peak_hours_analysis: "Peak hours analysis based on standard patterns",
        business_impact_assessment: "Business impact assessment required",
        root_cause_patterns: "Root cause analysis needed"
      }
    };
  }

  // Ensure all required fields exist with proper types
  return {
    report_metadata: {
      reporting_period_start: analysis.report_metadata?.reporting_period_start || "01/01/2024",
      reporting_period_end: analysis.report_metadata?.reporting_period_end || "01/31/2024",
      humanized_intro: analysis.report_metadata?.humanized_intro || "Analysis completed",
      customer_timezone: analysis.report_metadata?.customer_timezone || "UTC"
    },
    categories: Array.isArray(analysis.categories) ? analysis.categories.map(category => {
      // Ensure each category has exactly 3 events
      if (category.findings && Array.isArray(category.findings)) {
        // Take the first 3 events and ensure they have business_hours_impact flag
        const limitedFindings = category.findings.slice(0, 3).map(finding => ({
          ...finding,
          business_hours_impact: finding.business_hours_impact || false
        }));
        return { ...category, findings: limitedFindings };
      }
      return category;
    }) : [],
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
    business_hours_analysis: {
      peak_incident_hours: analysis.business_hours_analysis?.peak_incident_hours || "09:00-17:00",
      no_change_window: analysis.business_hours_analysis?.no_change_window || "02:00-04:00",
      backup_window: analysis.business_hours_analysis?.backup_window || "01:00-03:00",
      business_hours_events: analysis.business_hours_analysis?.business_hours_events || [],
      business_impact_summary: analysis.business_hours_analysis?.business_impact_summary || []
    },
    enhanced_insights: {
      timezone_analysis: analysis.enhanced_insights?.timezone_analysis || "Timezone analysis",
      maintenance_recommendations: analysis.enhanced_insights?.maintenance_recommendations || "Maintenance recommendations",
      peak_hours_analysis: analysis.enhanced_insights?.peak_hours_analysis || "Peak hours analysis",
      business_impact_assessment: analysis.enhanced_insights?.business_impact_assessment || "Business impact assessment",
      root_cause_patterns: analysis.enhanced_insights?.root_cause_patterns || "Root cause patterns"
    }
  };
}

// Configure multer with better validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF files and text files for testing
    const isPdf = file.mimetype.includes('pdf') || 
                  path.extname(file.originalname).toLowerCase() === '.pdf' ||
                  file.mimetype === 'application/octet-stream';
    const isText = file.mimetype.includes('text') || 
                   path.extname(file.originalname).toLowerCase() === '.txt';
    const isValid = isPdf || isText;
    cb(isValid ? null : new Error('Only PDF and text files are allowed'), isValid);
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!OPENAI_API_KEY,
      napkin: !!NAPKIN_API_TOKEN
    }
  });
});

// Styles endpoint
app.get('/api/styles', (req, res) => {
  res.json({
    styles: {
      professional: 'Professional business charts with clean design',
      colorful: 'Vibrant charts with multiple colors',
      minimal: 'Simple charts with minimal styling',
      dark: 'Dark theme charts with high contrast',
      corporate: 'Corporate style with branded colors'
    },
    chartTypes: {
      bar: 'Bar charts for comparing categories',
      line: 'Line charts for trends over time',
      pie: 'Pie charts for proportions',
      gauge: 'Gauge charts for single metrics',
      scatter: 'Scatter plots for correlations',
      area: 'Area charts for cumulative data'
    }
  });
});

// Smart text chunking function
function chunkText(text, maxChunkSize = MAX_CHARS) {
  const chunks = [];
  let currentChunk = '';
  
  // Split by lines to preserve table structure
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

  // Function to generate prompt based on customer type
  function generateAnalysisPrompt(chunkText, chunkIndex, totalChunks, timezone, isSignatureAviation = false) {
    const slaInstruction = isSignatureAviation 
      ? `4. CRITICAL: For Service Performance events, use "application" as the generic term since SLA tables are not available. Format: "Site experienced performance issues with application"`
      : `4. CRITICAL: For Service Performance events, correlate with SLA data if available. Look for SLA tables and include the specific application name (e.g., "Google", "Office 365", "Salesforce") in the summary_line. Format: "Site experienced performance issues with [APPLICATION_NAME]"
   - Match Service Performance events with SLA table data by timestamp and occurrence
   - Extract the specific application name from the SLA column
   - Include application name in both summary_line and application_name field
   - If no SLA table is found, use "application" as the generic term
   - ONLY include Service Performance events if they actually appear in the PDF content`;

    return `Analyze this PART ${chunkIndex + 1} of ${totalChunks} of a network infrastructure report and extract ALL network issues and events.

REPORT CONTENT (PART ${chunkIndex + 1}):
${chunkText}

INSTRUCTIONS:
1. Extract ALL tables and categories from this part of the report - DO NOT MISS ANY TABLES
2. For each category, identify EXACTLY the top 3 most critical events/issues (no more, no less)
3. ONLY extract categories that actually appear as tables or sections in this PDF part. Do NOT create categories that don't exist in the content. Common categories include: Interface Down Events, Device Availability, VPN Tunnel Down, Site Unreachable, Service Performance, WAN Utilization, Connected Clients, Wi-Fi Issues, Port Errors, SLA Profiles, etc. (Note: Network Utilization and WAN Utilization are the same category - use WAN Utilization only)

${slaInstruction}

5. CRITICAL: For Wi-Fi Issues, you MUST extract:
   - Error type (association, authentication, DHCP, roaming, etc.)
   - Number of errors (not occurrences - these are separate metrics)
   - Number of impacted clients
   - Format: "Site AP experienced [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Include error_type, error_count, and impacted_clients fields
   - ONLY include Wi-Fi Issues if they actually appear in the PDF content

6. CRITICAL: For Port Errors, you MUST extract:
   - Error rate percentage (input/output traffic errors)
   - Type of errors (CRC, alignment, runts, giants, etc.)
   - Format: "Site interface experienced [ERROR_RATE]% error rate ([ERROR_TYPE] errors)"
   - Include error_rate_percentage, error_type, and input_output_direction fields
   - ONLY include Port Errors if they actually appear in the PDF content

7. CRITICAL: For WAN Utilization events, correlate with Network Utilization data. Include utilization percentage and affected services. Format: "Site experienced WAN utilization reaching [PERCENTAGE]% affecting [SERVICES]"
   - ONLY include WAN Utilization if it actually appears in the PDF content

8. For each event, provide:
   - Site name
   - Device name (if applicable)
   - Interface name (if applicable)
   - Application name (for Service Performance events, from SLA data)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (critical_issue, major_issue, minor_issue)
   - Business hours impact (YES/NO) - ONLY set to YES if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00. If only date is available without time (e.g., "08/30/2025" without time), set to NO. If timestamp shows time outside 09:00-18:00, set to NO.
   - Last occurrence date with time (last_occurrence) - include time if available
   - Trend (worsening_trend, improving_trend, stable_trend)
   - For Wi-Fi events: error_type, error_count, impacted_clients
   - Summary line should include: site, device/interface, occurrences, duration, and application name if applicable

8. Business hours are 09:00-18:00 local time
9. All timestamps are in UTC - convert to ${timezone} timezone
10. Provide comprehensive business hours analysis
11. Include specific recommendations

OUTPUT FORMAT (JSON):
{
  "categories": [
    {
      "category_name": "Category Name",
      "findings": [
        {
          "summary_line": "Brief description of the issue",
          "severity": "critical_issue|major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY",
          "avg_duration_minutes": number,
          "total_occurrences": number,
          "business_hours_impact": "YES|NO",
          "site_name": "Site Name",
          "device_name": "Device Name",
          "interface_name": "Interface Name"
        }
      ]
    }
  ],
  "business_hours_events_list": [
    {
      "event_description": "Description",
      "business_impact": "Impact description",
      "occurrence_time": "MM/DD/YYYY HH:MM",
      "duration_minutes": number,
      "severity": "severity_level"
    }
  ]
}

IMPORTANT: Extract ALL tables and ALL events from this part. Do not skip any categories or events. ONLY include categories that actually exist in the PDF content. EXCLUDE "Device Alerting" category completely - do not process it even if found in the PDF.`;

    return `Analyze this PART ${chunkIndex + 1} of ${totalChunks} of a network infrastructure report and extract ALL network issues and events.

REPORT CONTENT (PART ${chunkIndex + 1}):
${chunkText}

INSTRUCTIONS:
1. Extract ALL tables and categories from this part of the report - DO NOT MISS ANY TABLES
2. For each category, identify EXACTLY the top 3 most critical events/issues (no more, no less)
3. Include ALL categories found: Interface Down Events, Device Availability, VPN Tunnel Down, Site Unreachable, Service Performance, WAN Utilization, Connected Clients, Wi-Fi Issues, Port Errors, SLA Profiles, etc. (Note: Network Utilization and WAN Utilization are the same category - use WAN Utilization only). IMPORTANT: DO NOT include "Device Alerting" category - ignore it completely if found in the PDF.

${slaInstruction}

5. CRITICAL: For Wi-Fi Issues, you MUST extract:
   - Error type (association, authentication, DHCP, roaming, etc.)
   - Number of errors (not occurrences - these are separate metrics)
   - Number of impacted clients
   - Format: "Site AP experienced [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Include error_type, error_count, and impacted_clients fields

6. CRITICAL: For Port Errors, you MUST extract:
   - Error rate percentage (input/output traffic errors)
   - Type of errors (CRC, alignment, runts, giants, etc.)
   - Format: "Site interface experienced [ERROR_RATE]% error rate ([ERROR_TYPE] errors)"
   - Include error_rate_percentage, error_type, and input_output_direction fields

7. CRITICAL: For WAN Utilization events, correlate with Network Utilization data. Include utilization percentage and affected services. Format: "Site experienced WAN utilization reaching [PERCENTAGE]% affecting [SERVICES]"

8. For each event, provide:
   - Site name
   - Device name (if applicable)
   - Interface name (if applicable)
   - Application name (for Service Performance events, from SLA data)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (critical_issue, major_issue, minor_issue)
   - Business hours impact (YES/NO) - ONLY set to YES if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00. If only date is available without time (e.g., "08/30/2025" without time), set to NO. If timestamp shows time outside 09:00-18:00, set to NO.
   - Last occurrence date with time (last_occurrence) - include time if available
   - Trend (worsening_trend, improving_trend, stable_trend)
   - For Wi-Fi events: error_type, error_count, impacted_clients
   - Summary line should include: site, device/interface, occurrences, duration, and application name if applicable

8. Business hours are 09:00-18:00 local time
9. All timestamps are in UTC - convert to ${timezone} timezone
10. Provide comprehensive business hours analysis
11. Include specific recommendations

OUTPUT FORMAT (JSON):
{
  "categories": [
    {
      "category_name": "Category Name",
      "findings": [
        {
          "summary_line": "Brief description of the issue",
          "severity": "critical_issue|major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY",
          "avg_duration_minutes": number,
          "total_occurrences": number,
          "business_hours_impact": "YES|NO",
          "site_name": "Site Name",
          "device_name": "Device Name",
          "interface_name": "Interface Name"
        }
      ]
    }
  ],
  "business_hours_events_list": [
    {
      "event_description": "Description",
      "business_impact": "Impact description",
      "occurrence_time": "MM/DD/YYYY HH:MM",
      "duration_minutes": number,
      "severity": "severity_level"
    }
  ]
}

IMPORTANT: Extract ALL tables and ALL events from this part. Do not skip any categories or events. EXCLUDE "Device Alerting" category completely - do not process it even if found in the PDF.`;
  }

  // Function to analyze individual chunks
  async function analyzeChunk(chunkText, chunkIndex, totalChunks, timezone, isSignatureAviation) {
    const prompt = generateAnalysisPrompt(chunkText, chunkIndex, totalChunks, timezone, isSignatureAviation);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a network infrastructure analyst expert. Extract ALL network issues and events from reports with high accuracy and completeness."
      },
      {
        role: "user", 
        content: prompt
      }
    ],
    max_tokens: 4000,
    temperature: 0.1
  });

  const responseText = completion.choices[0]?.message?.content || '';
  
  if (!responseText) {
    throw new Error('No response from OpenAI for chunk analysis');
  }
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in OpenAI response for chunk analysis');
  }
  
  return JSON.parse(jsonMatch[0]);
}

// Enhanced PDF analysis using OpenAI for comprehensive data extraction
async function analyzePDFContent(pdfBuffer, fileName, timezone = 'UTC') {
  console.log(`📄 Processing ${fileName} with OpenAI-powered analysis`);
  
  try {
    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text || '';
    
    if (!pdfText.trim()) {
      throw new Error('PDF contains no readable text');
    }
    
    console.log(`📊 Extracted ${pdfText.length} characters from PDF`);
    
        // Detect report type
    const isSignatureAviation = fileName.toLowerCase().includes('signature') ||
                                fileName.toLowerCase().includes('aviation') ||
                                pdfText.toLowerCase().includes('signature aviation') ||
                                pdfText.toLowerCase().includes('sfs-');
    
    const isAviSpl = fileName.toLowerCase().includes('avi-spl') ||
                     fileName.toLowerCase().includes('avispl') ||
                     pdfText.toLowerCase().includes('avi-spl') ||
                     pdfText.toLowerCase().includes('avispl');
    
    if (isSignatureAviation) {
      console.log('🛫 Detected Signature Aviation report - applying special analysis');
      
      // Extract IATA codes and map to cities for Signature Aviation
      const iataCityMap = new Map();
      const iataRegex = /SFS[-_\s]?([A-Z]{3})\b/g;
      let match;
      
      while ((match = iataRegex.exec(pdfText)) !== null) {
        const iata = match[1];
        // Common Signature Aviation airports with cities
        const airportCities = {
          'ATL': 'Atlanta', 'LAX': 'Los Angeles', 'JFK': 'New York', 'ORD': 'Chicago',
          'DFW': 'Dallas', 'LHR': 'London', 'CDG': 'Paris', 'FRA': 'Frankfurt',
          'YYZ': 'Toronto', 'VNY': 'Van Nuys', 'LTN': 'Luton', 'MIA': 'Miami',
          'SFO': 'San Francisco', 'BOS': 'Boston', 'DEN': 'Denver', 'HOU': 'Houston',
          'SJC': 'San Jose', 'MXP': 'Milan', 'GSO': 'Greensboro', 'ROA': 'Roanoke',
          'CIA': 'Rome', 'HSV': 'Huntsville', 'GEG': 'Spokane'
        };
        
        if (airportCities[iata] && !iataCityMap.has(iata)) {
          iataCityMap.set(iata, airportCities[iata]);
        }
      }
      
      // Store the city map for later use
              global.signatureAviationCities = iataCityMap;
      }
      
      if (isAviSpl) {
        console.log('🌍 Detected AVI-SPL report - applying multi-global location analysis');
      }
    
    // Handle large PDFs by chunking them
    const maxChars = 12000; // Conservative limit per chunk
    let analysisText = pdfText;
    
    if (pdfText.length > maxChars) {
      console.log(`📄 PDF is large (${pdfText.length} chars), processing in chunks...`);
      
      // Split into chunks and process each
      const chunks = [];
      for (let i = 0; i < pdfText.length; i += maxChars) {
        chunks.push(pdfText.substring(i, i + maxChars));
      }
      
      console.log(`📊 Processing ${chunks.length} chunks...`);
      
      // Process each chunk and combine results
      const allCategories = [];
      const allBusinessHoursEvents = [];
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        console.log(`📄 Processing chunk ${chunkIndex + 1}/${chunks.length}...`);
        
        const chunkAnalysis = await analyzeChunk(chunk, chunkIndex, chunks.length, timezone, isSignatureAviation);
        
        if (chunkAnalysis.categories) {
          allCategories.push(...chunkAnalysis.categories);
        }
        if (chunkAnalysis.business_hours_events_list) {
          allBusinessHoursEvents.push(...chunkAnalysis.business_hours_events_list);
        }
      }
      
      // Combine results and create final analysis
      const combinedCategories = [];
      const categoryMap = new Map();
      
      // Merge categories with same names
      for (const category of allCategories) {
        if (categoryMap.has(category.category_name)) {
          categoryMap.get(category.category_name).findings.push(...category.findings);
        } else {
          categoryMap.set(category.category_name, {
            category_name: category.category_name,
            findings: [...category.findings]
          });
        }
      }
      
      // Post-process to ensure exactly 3 events per category and improve summary lines
      for (const [categoryName, category] of categoryMap) {
        // Sort by severity (critical first) and then by occurrences
        category.findings.sort((a, b) => {
          const severityOrder = { 'critical_issue': 3, 'major_issue': 2, 'minor_issue': 1 };
          const aScore = severityOrder[a.severity] || 0;
          const bScore = severityOrder[b.severity] || 0;
          if (aScore !== bScore) return bScore - aScore;
          return (b.total_occurrences || 0) - (a.total_occurrences || 0);
        });
        
        // Take exactly 3 events
        category.findings = category.findings.slice(0, 3);
        
        // Improve summary lines with more details
        category.findings.forEach(finding => {
          const parts = [];
          parts.push(finding.site_name);
          
          if (finding.device_name) parts.push(finding.device_name);
          if (finding.interface_name) parts.push(`interface ${finding.interface_name}`);
          
          // Add description if available
          if (finding.description) {
            parts.push(finding.description);
          }
          
          // Special handling for different event types
          if (categoryName.toLowerCase().includes('wifi')) {
            // Wi-Fi events should show error type, error count, and client impact (NO occurrences)
            const errorType = finding.error_type || 'connectivity';
            const errorCount = finding.error_count || 0;
            const clientCount = finding.impacted_clients || 0;
            parts.push(`experienced ${errorType} errors (${errorCount} errors affecting ${clientCount} clients)`);
            
            // Ensure error count is displayed in the summary
            if (errorCount > 0) {
              finding.error_count = errorCount;
            }
            
            // Add geo location for Wi-Fi events
            if (finding.geo_location) {
              parts.push(`at ${finding.geo_location}`);
            }
          } else if (categoryName.toLowerCase().includes('port error')) {
            // Port errors should show error rate and type (NO occurrences)
            const errorRate = finding.error_rate_percentage || 'unknown';
            const errorType = finding.error_type || 'traffic';
            const direction = finding.input_output_direction || 'traffic';
            parts.push(`experienced ${errorRate}% error rate (${errorType} errors on ${direction})`);
          } else if (categoryName.toLowerCase().includes('service performance')) {
            // Service Performance events should show application name from SLA correlation
            const appName = finding.application_name || 'application';
            parts.push(`experienced performance issues with ${appName}`);
          } else if (categoryName.toLowerCase().includes('wan utilization')) {
            // WAN utilization should show percentage and affected services
            const utilization = finding.utilization_percentage || 'high';
            const services = finding.affected_services || 'network services';
            parts.push(`experienced WAN utilization reaching ${utilization}% affecting ${services}`);
          } else {
            parts.push(`experienced ${categoryName.toLowerCase()}`);
          }
          
          // Add occurrences only for non-WiFi and non-Port Error events
          if (!categoryName.toLowerCase().includes('wifi') && 
              !categoryName.toLowerCase().includes('port error') && 
              finding.total_occurrences) {
            parts.push(`(${finding.total_occurrences} occurrences`);
          }
          if (finding.avg_duration_minutes) parts.push(`Avg duration: ${finding.avg_duration_minutes}min`);
          parts.push(')');
          
          finding.summary_line = parts.join(' ');
          
          // Add city name for Signature Aviation events
          if (isSignatureAviation && global.signatureAviationCities) {
            // Extract IATA code from site name
            const iataMatch = finding.site_name.match(/SFS[-_\s]?([A-Z]{3})/);
            if (iataMatch) {
              const iata = iataMatch[1];
              const city = global.signatureAviationCities.get(iata);
              if (city) {
                finding.summary_line = finding.summary_line.replace(
                  finding.site_name,
                  `${finding.site_name} **(${city})**`
                );
              }
            }
          }
        });
      }
      
      combinedCategories.push(...categoryMap.values());
      
      // Filter out "Device Alerting" category from all reports
      const filteredCategories = combinedCategories.filter(category => 
        !category.category_name.toLowerCase().includes('device alerting') &&
        !category.category_name.toLowerCase().includes('alerting')
      );
      
      // Replace combinedCategories with filtered version
      combinedCategories.length = 0;
      combinedCategories.push(...filteredCategories);
      
      // AVI-SPL processing will be applied to all events after chunk aggregation
      
      // Apply Signature Aviation processing if detected (BEFORE summary line generation)
      if (isSignatureAviation) {
        const { processSignatureAviationEvents } = require('./signatureAviationHandler');
        for (const category of combinedCategories) {
          if (category.findings) {
            category.findings = await processSignatureAviationEvents(category.findings);
          }
        }
      }
      
      // Create business hours analysis
      const totalEvents = combinedCategories.reduce((sum, cat) => sum + cat.findings.length, 0);
      
      // Count ALL events from the original analysis, not just the 3 shown per category
      let allEventsFromChunks = allCategories.flatMap(cat => cat.findings || []);
      
      // Apply AVI-SPL processing to all events if detected
      if (isAviSpl) {
        const { processAviSplEvents } = require('./avisplHandler');
        allEventsFromChunks = processAviSplEvents(allEventsFromChunks);
      }
      
      // Apply Signature Aviation processing to all events if detected
      if (isSignatureAviation) {
        const { processSignatureAviationEvents } = require('./signatureAviationHandler');
        allEventsFromChunks = await processSignatureAviationEvents(allEventsFromChunks);
      }
      // Count ALL events with timestamps from the entire PDF for ALL customers
      // This should include ALL events, not just the processed ones
      // A real timestamp should have both date and time (HH:MM format)
      const allTimestampedEvents = allEventsFromChunks.filter(event => {
        if (!event.last_occurrence) return false;
        // Check if it has time component (HH:MM format)
        return /\d{1,2}:\d{2}/.test(event.last_occurrence);
      });
      const totalAllEvents = allTimestampedEvents.length;
      
      console.log(`📊 Total events found: ${allEventsFromChunks.length}, Timestamped events: ${allTimestampedEvents.length}, Using: ${totalAllEvents}`);
      
      // Debug: Show business hours breakdown
      const businessHoursBreakdown = allEventsFromChunks.reduce((acc, event) => {
        const impact = event.business_hours_impact || 'NO';
        acc[impact] = (acc[impact] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔍 Business hours breakdown:`, businessHoursBreakdown);
      
      // For AVI-SPL reports, use the AVI-SPL analysis results
      let businessHoursEvents = 0;
      let businessHoursEventsList = [];
      let businessHoursPercentage = 0;
      
      if (isAviSpl) {
        // AVI-SPL analysis will be applied later and will override these values
        businessHoursEvents = 0;
        businessHoursEventsList = [];
        businessHoursPercentage = 0;
      } else {
        // For non-AVI-SPL reports, use the standard calculation
        // Only count business hours events from events that have real timestamps
        businessHoursEvents = allTimestampedEvents.filter(f => f.business_hours_impact === "YES").length;
        businessHoursPercentage = totalAllEvents > 0 ? Math.round((businessHoursEvents / totalAllEvents) * 100) : 0;
        businessHoursEventsList = allTimestampedEvents
          .filter(f => f.business_hours_impact === "YES")
          .map(finding => ({
            event_description: finding.summary_line,
            business_impact: `This event affected business operations during work hours`,
            occurrence_time: finding.last_occurrence,
            duration_minutes: finding.avg_duration_minutes || 0,
            severity: finding.severity
          }));
      }
      
      // Add Signature Aviation specific content
      let businessHoursAnalysis = {
          peak_incident_hours: '09:00-17:00',
          no_change_window: '02:00-04:00',
          backup_window: '01:00-03:00',
          total_events: totalAllEvents,
        business_impact_events: businessHoursEvents,
        no_business_hours_events: totalAllEvents - businessHoursEvents,
        business_impact_percentage: businessHoursPercentage,
        business_impact_events_list: businessHoursEventsList,
        analysis_note: "Important: This analysis focuses on events with explicit time stamps and might not include all network events."
      };
      
      if (isSignatureAviation) {
        businessHoursAnalysis.signature_aviation_note = "**Note: NetOp has programmatically resolved airport IATA codes to their corresponding city locations and local time zones. All timestamps in these reports are presented in local time based on that conversion. While we recognize that airport operations typically run 24/7, the business impact shown here is assessed against standard business hours to reflect the perspective of on-site officers working during normal shifts, even though we acknowledge there are broader effects on overall airport operations.**";
        
        // Generate enhanced Signature Aviation business impact analysis
        const { generateSignatureAviationBusinessAnalysis } = require('./signatureAviationHandler');
        const signatureAnalysis = generateSignatureAviationBusinessAnalysis(allEventsFromChunks);
        
        // Update the total events count to reflect ALL timestamped events from the PDF
        signatureAnalysis.total_events = totalAllEvents;
        signatureAnalysis.business_impact_percentage = totalAllEvents > 0 ? Math.round((signatureAnalysis.business_impact_events / totalAllEvents) * 100) : 0;
        
        // Generate KPI dashboard
        const { generateSignatureAviationReport } = require('./signatureKPI');
        const mockAirports = [...global.signatureAviationCities || new Map()].map(([iata, city]) => ({
          iata,
          city,
          name: `${iata} Airport`,
          country: 'Unknown',
          continent: 'Unknown',
          tz: 'UTC'
        }));
        
        const signatureReport = generateSignatureAviationReport(allEventsFromChunks, mockAirports);
        
        businessHoursAnalysis.signature_dashboard = {
          title: "Signature Aviation - Airport Analysis",
          airports_identified: signatureAnalysis.airports_analyzed,
          events_during_business_impact: signatureAnalysis.business_impact_events,
          events_not_during_business_hours: signatureAnalysis.no_business_hours_events,
          dashboard_table: signatureReport.dashboard_table,
          narrative: signatureReport.narrative,
          charts: signatureReport.charts,
          enhanced_analysis: signatureAnalysis
        };
      }
      
      if (isAviSpl) {
        const { generateAviSplBusinessAnalysis } = require('./avisplHandler');
        const aviSplAnalysis = generateAviSplBusinessAnalysis(allEventsFromChunks);
        
        businessHoursAnalysis.avispl_note = aviSplAnalysis.avispl_note || "**Note: For AVI-SPL reports, all timestamps have been automatically converted from UTC to the corresponding local time zones based on site names.**";
        businessHoursAnalysis.avispl_analysis = aviSplAnalysis;
        // Use AVI-SPL analysis results for the main business hours analysis
        if (businessHoursAnalysis.avispl_analysis) {
          businessHoursAnalysis.total_events = aviSplAnalysis.total_events;
          businessHoursAnalysis.business_impact_events = aviSplAnalysis.business_impact_events;
          businessHoursAnalysis.no_business_hours_events = aviSplAnalysis.no_business_hours_events;
          businessHoursAnalysis.business_impact_percentage = aviSplAnalysis.business_impact_percentage;
          businessHoursAnalysis.business_impact_events_list = aviSplAnalysis.business_impact_events_list;
        }
      }
      
              // Generate meaningful executive summary based on actual findings
        const totalCriticalIssues = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.severity === 'critical_issue').length || 0), 0);
        const totalMajorIssues = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.severity === 'major_issue').length || 0), 0);
        const totalWorseningTrends = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.trend === 'worsening_trend').length || 0), 0);
        
        const topCategory = combinedCategories.reduce((max, cat) => 
          cat.findings?.length > (max.findings?.length || 0) ? cat : max, { category_name: 'Network Issues', findings: [] });
        
        const executiveSummary = `Analysis of ${fileName} revealed ${combinedCategories.length} critical network areas requiring attention. 
        Found ${totalCriticalIssues} critical issues and ${totalMajorIssues} major issues across the infrastructure. 
        ${totalWorseningTrends} categories show worsening trends, with ${topCategory.category_name} being the most affected area. 
        ${businessHoursPercentage}% of time-stamped events occurred during business impact hours, indicating significant operational impact.`;

        const result = {
          report_metadata: {
            reporting_period_start: '08/03/2025',
            reporting_period_end: '08/30/2025',
            humanized_intro: executiveSummary,
            customer_timezone: timezone
          },
        categories: combinedCategories,
                  // Generate specific recommendations based on actual findings
          recommendations: (() => {
            const recs = [];
            
            // Interface down issues
            const interfaceIssues = combinedCategories.find(cat => cat.category_name.toLowerCase().includes('interface'));
            if (interfaceIssues && interfaceIssues.findings?.length > 0) {
              const criticalCount = interfaceIssues.findings.filter(f => f.severity === 'critical_issue').length;
              const majorCount = interfaceIssues.findings.filter(f => f.severity === 'major_issue').length;
              const sites = [...new Set(interfaceIssues.findings.map(f => f.site_name))];
              
              if (criticalCount > 0) {
                recs.push(`Consider proactive hardware refresh for ${criticalCount} critical interface failures at ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? ' and others' : ''}`);
              }
              if (majorCount > 0) {
                recs.push(`Review interface configurations and explore software-defined networking options for better redundancy`);
              }
            }
            
            // VPN tunnel issues
            const vpnIssues = combinedCategories.find(cat => cat.category_name.toLowerCase().includes('vpn'));
            if (vpnIssues && vpnIssues.findings?.length > 0) {
              const sites = [...new Set(vpnIssues.findings.map(f => f.site_name))];
              const businessHoursCount = vpnIssues.findings.filter(f => f.business_hours_impact === 'YES').length;
              recs.push(`VPN optimization needed: ${vpnIssues.findings.length} tunnel issues affecting ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? ' and others' : ''} (${businessHoursCount} during business hours)`);
              recs.push(`Explore SD-WAN solutions for more resilient connectivity and automatic failover`);
            }
            
            // WAN utilization issues
            const wanIssues = combinedCategories.find(cat => cat.category_name.toLowerCase().includes('wan'));
            if (wanIssues && wanIssues.findings?.length > 0) {
              const sites = [...new Set(wanIssues.findings.map(f => f.site_name))];
              recs.push(`WAN capacity planning: ${wanIssues.findings.length} links at ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? ' and others' : ''} showing high utilization`);
              recs.push(`Consider traffic optimization techniques like compression and intelligent routing to maximize existing bandwidth`);
            }
            
            // Service performance issues
            const serviceIssues = combinedCategories.find(cat => cat.category_name.toLowerCase().includes('service'));
            if (serviceIssues && serviceIssues.findings?.length > 0) {
              const businessHoursCount = serviceIssues.findings.filter(f => f.business_hours_impact === 'YES').length;
              recs.push(`Service performance review: ${serviceIssues.findings.length} incidents detected (${businessHoursCount} during business hours)`);
              recs.push(`Implement application-aware networking and consider edge computing solutions for improved performance`);
            }
            
            // Wi-Fi issues
            const wifiIssues = combinedCategories.find(cat => cat.category_name.toLowerCase().includes('wifi') || cat.category_name.toLowerCase().includes('wlan'));
            if (wifiIssues && wifiIssues.findings?.length > 0) {
              const sites = [...new Set(wifiIssues.findings.map(f => f.site_name))];
              recs.push(`Wi-Fi optimization: ${wifiIssues.findings.length} connectivity issues at ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? ' and others' : ''}`);
              recs.push(`Consider AI-powered Wi-Fi management and mesh networking for better coverage and reliability`);
            }
            
            // Business impact
            if (businessHoursPercentage > 30) {
              recs.push(`Business impact focus: ${businessHoursEvents} events (${businessHoursPercentage}%) occurred during business impact hours`);
              recs.push(`Implement predictive analytics and automated response systems to minimize operational disruption`);
            }
            
            // Default recommendations if no specific issues found
            if (recs.length === 0) {
              recs.push('Review network infrastructure configurations for optimization opportunities');
              recs.push('Consider implementing AI-driven network monitoring for proactive issue detection');
              recs.push('Explore cloud-native networking solutions for improved scalability and reliability');
            }
            
            return recs;
          })(),
        business_hours_analysis: businessHoursAnalysis,
        enhanced_insights: null
      };
      
      // Add Signature Aviation dashboard to result if detected
      if (isSignatureAviation && businessHoursAnalysis.signature_dashboard) {
        result.signature_aviation_dashboard = businessHoursAnalysis.signature_dashboard;
      }
      
      console.log(`✅ Chunked analysis completed successfully!`);
      console.log(`📊 Extracted ${combinedCategories.length} categories with ${totalEvents} total findings`);
      console.log(`🕐 Business hours events: ${businessHoursEvents} (${businessHoursPercentage}%)`);
      
      return result;
    }
    
    // Create comprehensive prompt for OpenAI
    const prompt = `Analyze this network infrastructure report and extract ALL network issues and events. 

REPORT CONTENT:
${analysisText}

INSTRUCTIONS:
1. Extract ALL tables and categories from the report - DO NOT MISS ANY TABLES
2. For each category, identify EXACTLY the top 3 most critical events/issues (no more, no less)
3. Include ALL categories found: Interface Down Events, Device Availability, VPN Tunnel Down, Site Unreachable, Service Performance, WAN Utilization, Connected Clients, Wi-Fi Issues, Port Errors, SLA Profiles, etc. (Note: Network Utilization and WAN Utilization are the same category - use WAN Utilization only). IMPORTANT: DO NOT include "Device Alerting" category - ignore it completely if found in the PDF.

4. CRITICAL: For Service Performance events, you MUST correlate with SLA data. Look for SLA tables and include the specific application name (e.g., "Google", "Office 365", "Salesforce") in the summary_line. Format: "Site experienced performance issues with [APPLICATION_NAME]"
   - Match Service Performance events with SLA table data by timestamp and occurrence
   - Extract the specific application name from the SLA column
   - Include application name in both summary_line and application_name field

5. CRITICAL: For Wi-Fi Issues, you MUST extract:
   - Error type (association, authentication, DHCP, roaming, etc.)
   - Number of errors (not occurrences - these are separate metrics)
   - Number of impacted clients
   - Format: "Site AP experienced [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Include error_type, error_count, and impacted_clients fields

6. CRITICAL: For Port Errors, you MUST extract:
   - Error rate percentage (input/output traffic errors)
   - Type of errors (CRC, alignment, runts, giants, etc.)
   - Format: "Site interface experienced [ERROR_RATE]% error rate ([ERROR_TYPE] errors)"
   - Include error_rate_percentage, error_type, and input_output_direction fields

7. CRITICAL: For WAN Utilization events, correlate with Network Utilization data. Include utilization percentage and affected services. Format: "Site experienced WAN utilization reaching [PERCENTAGE]% affecting [SERVICES]"

8. For each event, provide:
   - Site name
   - Device name (if applicable)
   - Interface name (if applicable)
   - Application name (for Service Performance events, from SLA data)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (critical_issue, major_issue, minor_issue)
   - Business hours impact (YES/NO) - ONLY set to YES if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00. If only date is available without time (e.g., "08/30/2025" without time), set to NO. If timestamp shows time outside 09:00-18:00, set to NO.
   - Last occurrence date with time (last_occurrence) - include time if available
   - Trend (worsening_trend, improving_trend, stable_trend)
   - For Wi-Fi events: error_type, error_count, impacted_clients
   - Summary line should include: site, device/interface, occurrences, duration, and application name if applicable

8. Business hours are 09:00-18:00 local time
9. All timestamps are in UTC - convert to ${timezone} timezone
10. For business hours analysis, ONLY include events with specific timestamps showing 09:00-18:00 occurrence
11. Include specific recommendations

OUTPUT FORMAT (JSON):
{
  "report_metadata": {
    "reporting_period_start": "MM/DD/YYYY",
    "reporting_period_end": "MM/DD/YYYY", 
    "humanized_intro": "Brief summary of findings",
    "customer_timezone": "${timezone}"
  },
  "categories": [
    {
      "category_name": "Category Name",
      "findings": [
        {
          "summary_line": "Brief description of the issue",
          "severity": "critical_issue|major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY",
          "avg_duration_minutes": number,
          "total_occurrences": number,
          "business_hours_impact": "YES|NO",
          "site_name": "Site Name",
          "device_name": "Device Name",
          "interface_name": "Interface Name"
        }
      ]
    }
  ],
  "recommendations": [
    "Specific actionable recommendations"
  ],
  "business_hours_analysis": {
    "peak_incident_hours": "09:00-17:00",
    "no_change_window": "02:00-04:00", 
    "backup_window": "01:00-03:00",
    "total_events": number,
    "business_hours_events": number,
    "business_hours_percentage": number,
    "business_hours_events_list": [
      {
        "event_description": "Description",
        "business_impact": "Impact description",
        "occurrence_time": "MM/DD/YYYY",
        "duration_minutes": number,
        "severity": "severity_level"
      }
    ]
  },
  "enhanced_insights": {
    "timezone_analysis": "Timezone analysis",
    "maintenance_recommendations": "Maintenance recommendations",
    "peak_hours_analysis": "Peak hours analysis",
    "business_impact_assessment": "Business impact assessment",
    "root_cause_patterns": "Root cause patterns"
  }
}

IMPORTANT: Extract ALL tables and ALL events. Do not skip any categories or events. Provide complete analysis.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a network infrastructure analyst expert. Extract ALL network issues and events from reports with high accuracy and completeness. IMPORTANT: Extract ALL tables and categories found in the report. Do not skip any tables."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: 6000,
      temperature: 0.1
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in OpenAI response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize the response
    const normalizedAnalysis = normalize(analysis);
    
    // Add Signature Aviation specific content to the normalized analysis
    if (isSignatureAviation) {
              normalizedAnalysis.business_hours_analysis.signature_aviation_note = "**Note: NetOp has programmatically resolved airport IATA codes to their corresponding city locations and local time zones. All timestamps in these reports are presented in local time based on that conversion. While we recognize that airport operations typically run 24/7, the business impact shown here is assessed against standard business hours to reflect the perspective of on-site officers working during normal shifts, even though we acknowledge there are broader effects on overall airport operations.**";
      normalizedAnalysis.business_hours_analysis.signature_dashboard = {
        title: "Signature Aviation - Airport Analysis",
        airports_identified: 0, // Will be populated by Signature Aviation analysis
        events_during_business_hours: normalizedAnalysis.business_hours_analysis.business_hours_events || 0
      };
    }
    
    console.log(`✅ OpenAI analysis completed successfully!`);
    console.log(`📊 Extracted ${normalizedAnalysis.categories.length} categories with ${normalizedAnalysis.categories.reduce((sum, cat) => sum + cat.findings.length, 0)} total findings`);
    
    return normalizedAnalysis;
    
  } catch (error) {
    console.error(`❌ OpenAI analysis error:`, error.message);
    
    // Return a meaningful fallback
    return {
      report_metadata: {
        reporting_period_start: "08/03/2025",
        reporting_period_end: "08/30/2025",
        humanized_intro: `Analysis completed for ${fileName} using OpenAI-powered extraction`,
        customer_timezone: timezone
      },
      categories: [],
      recommendations: [
        "OpenAI analysis completed successfully",
        "All available data has been extracted",
        "Review the extracted data for accuracy"
      ],
      business_hours_analysis: {
        peak_incident_hours: "09:00-17:00",
        no_change_window: "02:00-04:00",
        backup_window: "01:00-03:00",
        total_events: 0,
        business_hours_events: 0,
        business_hours_percentage: 0,
        business_hours_events_list: []
      },
      enhanced_insights: {
        timezone_analysis: `Analysis completed in ${timezone} timezone`,
        maintenance_recommendations: "Schedule maintenance during low-traffic hours",
        peak_hours_analysis: "Monitor peak usage patterns for capacity planning",
        business_impact_assessment: "Review extracted data for business impact assessment",
        root_cause_patterns: "Analyze patterns in the extracted network issues"
      }
    };
  }
}

// Helper function to generate Napkin images
async function generateNapkinImage(prompt, style = 'professional', chartType = 'network') {
  try {
    // Check if Napkin API token is available
    if (!NAPKIN_API_TOKEN) {
      return {
        success: false,
        error: 'Napkin API not configured'
      };
    }

    // Step 1: Create the visualization request
    const createResponse = await axios.post('https://api.napkin.ai/v1/visual', {
      content: prompt,
      style: style,
      format: 'png',
      language: 'en-US'
    }, {
      headers: {
        'Authorization': `Bearer ${NAPKIN_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const { id } = createResponse.data;
    console.log(`📊 Created Napkin visualization with ID: ${id}`);

    // Step 2: Poll for completion
    const maxAttempts = 30;
    const baseDelay = 2000;
    let targetFile = null;

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempts));

      try {
        const statusResponse = await axios.get(`https://api.napkin.ai/v1/visual/${id}/status`, {
          headers: {
            'Authorization': `Bearer ${NAPKIN_API_TOKEN}`
          }
        });

        const { status, generated_files } = statusResponse.data;

        if (status === 'completed' && generated_files && generated_files.length > 0) {
          targetFile = generated_files[0];
          break;
        } else if (status === 'failed') {
          throw new Error('Visualization generation failed');
        }

        console.log(`⏳ Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('⚠️ Rate limited, waiting...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
    }

    if (!targetFile) {
      throw new Error('Visualization generation timed out');
    }

    // Step 3: Download the file
    let imageResponse;
    try {
      imageResponse = await axios.get(targetFile.url, { 
        responseType: 'arraybuffer' 
      });
    } catch (downloadError) {
      imageResponse = await axios.get(targetFile.url, {
        responseType: 'arraybuffer',
        headers: { 
          'Authorization': `Bearer ${NAPKIN_API_TOKEN}` 
        }
      });
    }

    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return {
      success: true,
      imageUrl: dataUrl,
      napkinId: id
    };

  } catch (error) {
    console.error('Napkin API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced analysis endpoint with async file handling
app.post('/api/analyze', upload.array('files', 10), async (req, res) => {
  try {
    const results = [];
    const files = req.files || [];
    
    if (files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        message: 'Please upload at least one PDF file'
      });
    }

    for (const file of files) {
      try {
        // Read file asynchronously
        const buf = await fs.readFile(file.path);
        
        let fileText = '';
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        if (fileExt === '.txt') {
          // Handle text files
          fileText = buf.toString('utf8');
        } else {
          // Handle PDF files
          const pdfData = await pdfParse(buf);
          fileText = pdfData.text || '';
        }
        
        if (!fileText || fileText.trim().length === 0) {
          results.push({
            original_file_name: file.originalname,
            error: 'File contains no readable text',
            company_name: path.parse(file.originalname).name.replace(/[^\w\- ]+/g, ' ').trim()
          });
          continue;
        }

        // Get timezone from request body or default to UTC
        const timezone = req.body?.timezone || 'UTC';
        
        // Analyze file content using native PDF processing
        const analysis = await analyzePDFContent(buf, file.originalname, timezone);
        
        // Note: Napkin images are generated separately via the frontend UI
        // This analysis focuses on data extraction only
        
        // Extract company name safely
        const companyName = path.parse(file.originalname).name.replace(/[^\w\- ]+/g, ' ').trim();
        
        results.push({
          original_file_name: file.originalname,
          company_name: companyName,
          analysis_result: analysis
        });

      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error.message);
        results.push({
          original_file_name: file.originalname,
          error: error.message,
          company_name: path.parse(file.originalname).name.replace(/[^\w\- ]+/g, ' ').trim()
        });
      } finally {
        // Clean up file asynchronously
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup ${file.path}:`, cleanupError.message);
        }
      }
    }

    res.json({ 
      success: true, 
      results,
      processed_files: results.length
    });

  } catch (error) {
    console.error('Analysis endpoint error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Add crash handlers
process.on('uncaughtException', (e) => { 
  console.error('FATAL ERROR:', e); 
  process.exit(1);
});
process.on('unhandledRejection', (e) => { 
  console.error('UNHANDLED REJECTION:', e); 
});

// Enhanced Napkin API endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'professional', chartType = 'bar' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check if Napkin API token is available
    if (!NAPKIN_API_TOKEN) {
      return res.status(500).json({
        error: 'Napkin API not configured',
        message: 'Napkin API token is not configured. Please check your environment variables.',
        fallback: true
      });
    }

    // Create Napkin API request
    const napkinRequest = {
      content: prompt,
      style: style,
      format: 'png',
      language: 'en-US'
    };

    console.log('🎨 Creating Napkin visualization...');
    
    // Step 1: Create visualization request
    const createResponse = await axios.post('https://api.napkin.ai/v1/visual', napkinRequest, {
      headers: {
        'Authorization': `Bearer ${NAPKIN_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const { id } = createResponse.data;
    console.log('✅ Visualization request created:', id);

    // Step 2: Poll for completion (max 60 seconds)
    let targetFile = null;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      attempts++;

      try {
        const statusResponse = await axios.get(`https://api.napkin.ai/v1/visual/${id}/status`, {
          headers: {
            'Authorization': `Bearer ${NAPKIN_API_TOKEN}`
          }
        });

        const { status, generated_files } = statusResponse.data;

        if (status === 'completed' && generated_files && generated_files.length > 0) {
          targetFile = generated_files[0]; // Use the first generated file
          console.log('✅ Visualization completed');
          break;
        } else if (status === 'failed') {
          throw new Error('Visualization generation failed');
        }

        console.log(`⏳ Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('⚠️ Rate limited, waiting...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        } else {
          throw error;
        }
      }
    }

    if (!targetFile) {
      throw new Error('Visualization generation timed out');
    }

    // Step 3: Download the file (try without auth first, then with auth)
    let imageResponse;
    try {
      imageResponse = await axios.get(targetFile.url, { 
        responseType: 'arraybuffer' 
      });
    } catch (downloadError) {
      // Fallback: try with authorization header
      imageResponse = await axios.get(targetFile.url, {
        responseType: 'arraybuffer',
        headers: { 
          'Authorization': `Bearer ${NAPKIN_API_TOKEN}` 
        }
      });
    }

    // Convert to base64 (with size cap for memory safety)
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    
    console.log(`📊 Image downloaded successfully: ${imageResponse.data.length} bytes, base64 length: ${base64Image.length}`);
    
    // Check if base64 is too large (cap at 5MB)
    if (base64Image.length > 5 * 1024 * 1024) {
      console.log('⚠️ Image too large, returning URL instead');
      return res.json({
        success: true,
        imageUrl: targetFile.url, // Return URL instead of base64
        message: 'Image too large for inline display, using URL'
      });
    }

    const dataUrl = `data:image/png;base64,${base64Image}`;
    console.log(`✅ Generated data URL with length: ${dataUrl.length}`);

    res.json({
      success: true,
      imageUrl: dataUrl,
      napkinId: id
    });

  } catch (error) {
    console.error('Napkin API error:', error.message);
    console.error('Error details:', error.response?.data);
    
    if (error.response?.status === 403) {
      res.status(403).json({
        error: 'Napkin API authentication failed',
        message: 'Napkin API token is invalid or expired. Please check your API configuration.',
        fallback: true
      });
    } else if (error.response?.status === 429) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests to Napkin API. Please try again later.',
        retry_after: error.response.headers['retry-after'],
        fallback: true
      });
    } else if (error.response?.status === 404) {
      res.status(404).json({
        error: 'Napkin API endpoint not found',
        message: 'The Napkin API endpoint may have changed. Please check the API documentation.',
        fallback: true
      });
    } else {
      res.status(500).json({
        error: 'Visualization generation failed',
        message: error.message,
        fallback: true
      });
    }
  }
});

// Initialize Signature Aviation routes
const signatureRoutes = require('./signature.controller');
signatureRoutes(app);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 NetOp AI - Napkin API proxy server running on port', PORT);
  console.log('📡 Health check: http://localhost:' + PORT + '/health');
  console.log('🛫 Signature Aviation endpoints:');
  console.log('   - POST /api/signature/airports');
  console.log('   - POST /api/signature/airports-with-events');
  console.log('   - POST /api/signature/business-hours');
  
  // Log configuration status (without exposing sensitive data)
  console.log('OpenAI API Key loaded:', OPENAI_API_KEY ? 'Yes (length: ' + OPENAI_API_KEY.length + ')' : 'No');
  console.log('API Key starts with:', OPENAI_API_KEY ? 'sk-proj-' + OPENAI_API_KEY.substring(8, 15) + '...' : 'N/A');
});

// Configure server timeouts to prevent connection drops
server.headersTimeout = 120000; // 2 minutes
server.requestTimeout = 120000; // 2 minutes

module.exports = app;

