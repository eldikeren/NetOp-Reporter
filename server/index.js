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
const { generateStructuredRecommendations } = require('./structuredRecommendations');

const app = express();
const PORT = process.env.PORT || 6000;

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

// Generate AI-powered executive summary
async function generateExecutiveSummary(categories, fileName, businessHoursText) {
  console.log('🔧 generateExecutiveSummary function starting...');
  console.log('🔧 Categories count:', categories.length);
  console.log('🔧 File name:', fileName);
  console.log('🔧 Business hours text:', businessHoursText);
  try {
    // Extract key data points for the AI prompt
    const wifiIssues = categories.find(cat => 
      cat.category_name.toLowerCase().includes('wi-fi') || cat.category_name.toLowerCase().includes('wifi')
    );
    
    const clientIssues = categories.find(cat => 
      cat.category_name.toLowerCase().includes('connected client') || cat.category_name.toLowerCase().includes('client')
    );
    
    const interfaceIssues = categories.find(cat => 
      cat.category_name.toLowerCase().includes('interface down') || cat.category_name.toLowerCase().includes('interface')
    );
    
    // Extract simple examples from any available findings
    const examples = [];
    
    // Get basic examples from any category with findings
    categories.forEach(category => {
      if (category.findings && category.findings.length > 0) {
        const finding = category.findings[0]; // Take first finding
        if (finding.site_name && finding.summary_line) {
          // Extract basic info from summary line
          const siteName = finding.site_name;
          const categoryType = category.category_name.toLowerCase();
          
          if (categoryType.includes('wi-fi') || categoryType.includes('wifi')) {
            if (finding.error_count && finding.impacted_clients) {
              examples.push(`${siteName} had ${finding.error_count} Wi-Fi errors affecting ${finding.impacted_clients} clients`);
            }
          } else if (categoryType.includes('interface down')) {
            if (finding.total_occurrences) {
              examples.push(`${siteName} experienced ${finding.total_occurrences} interface down events`);
            }
          } else if (categoryType.includes('connected client')) {
            if (finding.summary_line.includes('%')) {
              const match = finding.summary_line.match(/(-?\d+)%/);
              if (match) {
                examples.push(`${siteName} client connectivity changed by ${match[1]}%`);
              }
            }
          } else {
            // Generic example for other categories
            if (finding.total_occurrences && finding.total_occurrences > 0) {
              examples.push(`${siteName} had ${finding.total_occurrences} occurrences in ${category.category_name}`);
            }
          }
        }
      }
    });
    
    // Count available examples
    console.log('🔧 Available examples for executive summary:', examples);
    
    // NO FALLBACKS ALLOWED - If no examples, throw error
    if (examples.length === 0) {
      console.error('❌ NO EXAMPLES AVAILABLE - Cannot generate executive summary without real data');
      throw new Error('Executive summary generation failed: No valid examples found in PDF data. Cannot generate summary without real findings.');
    }
    
    const prompt = `STRICT RULES: You write executive summaries for network reports using ONLY provided data.

ABSOLUTELY FORBIDDEN - DO NOT USE:
- "Site A", "Site B", "Site C", "Site D" or any single-letter site names
- "Device 1", "Device 14", "Device 47", "Device 42" or any numbered devices  
- "affecting X clients", "impacting X users" unless exact client count is in provided examples
- "X% increase/decrease/rise/drop in [anything]" unless exact percentage is in examples
- "packet loss", "CPU utilization", "latency issues", "connection drops" unless in provided examples
- "during peak hours", "peak times" unless mentioned in provided examples
- "recurring connection drops for X hours" unless exact time is in examples
- "approximately X clients/users" unless exact count is in provided examples
- Any site names, device names, numbers, percentages, or technical terms NOT in the provided examples below

REQUIRED APPROACH:
- If examples provided: Use ONLY those exact site names, device names, and numbers
- If no examples: Write general summary about categories and findings without specifics
- Focus on: categories found, number of findings, operational impact areas
- Maximum 120 words, professional tone

VERIFIED EXAMPLES FROM THIS SPECIFIC REPORT:
${examples.length > 0 ? examples.map(example => `✓ REAL DATA: ${example}`).join('\n') : '❌ NO EXAMPLES PROVIDED - Write general category summary only'}

Report: ${fileName}
Context: ${businessHoursText}
Categories: ${categories.length}

GENERATE SUMMARY USING ONLY THE VERIFIED EXAMPLES ABOVE (zero fabrication):`;

    return openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "CRITICAL: You are FORBIDDEN from inventing ANY data. Use ONLY the exact site names, device names, and numbers provided. NEVER create \"Site B\", \"Device 14\", or any fabricated examples. If no examples provided, write generic category summary. ANY invention of data will be rejected."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.1
    }).then(completion => {
      const responseText = completion.choices[0]?.message?.content || '';
      
      if (!responseText) {
        // NO FALLBACKS - Throw error if AI generation fails
        throw new Error('Executive summary generation failed: AI returned empty response');
      }
      
      // Validate response - check for ANY fake site/device names or data
      const fakeSitePatterns = [
        /\bSite [A-Z]\b/g,           // Site A, Site B, Site C, etc.
        /\bDevice \d+\b/g,           // Device 1, Device 14, Device 47, etc.
        /\bSite \d+\b/g,             // Site 1, Site 2, etc.
        /\b(affecting|impacting) (approximately )?\d+ (client|user)[s]?\b/g,  // "affecting 120 clients", "impacting 75 users"
        /\b\d+% (increase|rise|drop|decrease) in (packet loss|CPU utilization|latency|bandwidth|performance)\b/g, // "23% increase in packet loss"
        /\b\d+ unexpected (reboot|outage|event|drop)[s]?\b/g,  // "15 unexpected reboots"
        /\baverage (delay|duration) of \d+ (millisecond|minute|hour)[s]?\b/g,  // "average delay of 300 milliseconds"
        /\b(recurring|repeated) (connection drop|outage|issue)[s]? for \d+ (hour|minute)[s]?\b/g, // "recurring connection drops for 2 hours"
        /\bduring peak (hour|time)[s]?\b/g, // "during peak hours"
        /\bpacket loss\b/g,          // Any mention of packet loss (not in real data)
        /\bCPU utilization\b/g,      // Any mention of CPU utilization (not in real data)
        /\bconnection drop[s]?\b/g,  // Any mention of connection drops (not in real data)
        /\blatency issue[s]?\b/g     // Any mention of latency issues (not in real data)
      ];
      
      let hasFakeData = false;
      let detectedPatterns = [];
      
      fakeSitePatterns.forEach((pattern, index) => {
        const matches = responseText.match(pattern);
        if (matches && matches.length > 0) {
          hasFakeData = true;
          detectedPatterns.push(`Pattern ${index + 1}: ${matches.join(', ')}`);
        }
      });
      
      if (hasFakeData) {
        console.error('❌ AI generated fake data, detected:', detectedPatterns);
        console.error('❌ Original response:', responseText);
        throw new Error('Executive summary generation failed: AI generated forbidden fake data patterns: ' + detectedPatterns.join(', '));
      }
      
      return responseText.trim();
    }).catch(error => {
      console.error('❌ Executive summary generation error:', error.message);
      // NO FALLBACKS - Re-throw the error
      throw error;
    });
  } catch (error) {
    console.error('❌ Executive summary generation error:', error.message);
    // Basic fallback to prevent complete system failure
    return `Network analysis completed for ${fileName.replace(/\.(pdf|txt)$/i, '')}. Analysis identified ${categories.length} categories with findings across multiple network areas.`;
  }
}

// Generate report title and date range from filename
function generateReportTitle(fileName) {
  console.log('🔧 generateReportTitle called with filename:', fileName);
  console.log('🔧 generateReportTitle function starting...');
  try {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.(pdf|txt)$/i, '');
    
    // Remove numbers in parentheses like (7), (3), etc.
    const nameWithoutNumbers = nameWithoutExt.replace(/\s*\(\d+\)\s*$/, '');
    
    // Extract customer name - take everything before the first underscore or dash
    let customerName = nameWithoutNumbers;
    const separatorMatch = nameWithoutNumbers.match(/^([^_-]+)/);
    if (separatorMatch) {
      customerName = separatorMatch[1];
    }
    
    // Clean up customer name - remove common suffixes
    customerName = customerName
      .replace(/_short_executive_report$/i, '')
      .replace(/_executive_report$/i, '')
      .replace(/_report$/i, '')
      .replace(/_short$/i, '')
      .trim();
    
    // Generate date range (past 7 days from today)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };
    
    const dateRange = {
      start: formatDate(sevenDaysAgo),
      end: formatDate(today)
    };
    
    // Generate report title
    const reportTitle = `${customerName} - Network Analysis Report`;
    
    return {
      customerName,
      reportTitle,
      dateRange
    };
    
  } catch (error) {
    console.error('❌ Report title generation error:', error.message);
    // Fallback values
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };
    
    return {
      customerName: 'Customer',
      reportTitle: `Customer - Network Analysis Report`,
      dateRange: {
        start: formatDate(sevenDaysAgo),
        end: formatDate(today)
      }
    };
  }
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
      : `4. CRITICAL: For Service Performance & SLA events, correlate Service Performance table with SLA Profiles table:
   - **RENAME CATEGORY**: Use "Service Performance & SLA" as the category name (not "Service Performance Incidents")
   - **EXTRACT SLA DATA**: Look for both "Service Performance" AND "SLA Profiles" tables in the PDF
   - **MATCH DATA**: For each Service Performance event, find the matching row in SLA Profiles table by site/device/interface
   - **EXTRACT SLA NAME**: Get the specific SLA name from the SLA column in SLA Profiles table (e.g., "Google", "Office 365", "Salesforce", "Guest_Internet")
   - **SLA COLUMN EXTRACTION**: For each Service Performance event, look up the corresponding SLA name by matching site/device/interface with SLA Profiles table
   - **FORMAT**: "Site [SITE] device [DEVICE] interface [INTERFACE] experienced [OCCURRENCES] SLA violations for [SLA_NAME] with average duration of [DURATION] minutes"
   - **INCLUDE FIELDS**: Add sla_name, sla_profile, application_name fields to each finding
   - **PRIORITY**: Show Service Performance events with matching SLA data first
   - **FALLBACK**: If no SLA table found, use "application" as generic term
   - **REQUIREMENT**: ONLY include this category if BOTH tables exist in the PDF`;

    return `Analyze this PART ${chunkIndex + 1} of ${totalChunks} of a network infrastructure report and extract ALL network issues and events.

REPORT CONTENT (PART ${chunkIndex + 1}):
${chunkText}

INSTRUCTIONS:
1. Extract ALL tables and categories from this part of the report - DO NOT MISS ANY TABLES
2. For each category, extract up to 8-12 events from the table (more than 3 but not unlimited)
   CRITICAL: Extract 5-12 events per table to show realistic counts while keeping response manageable
3. ONLY extract categories that actually appear as tables or sections in this PDF part. Do NOT create categories that don't exist in the content. Common categories include: Interface Down Events, Device Availability, VPN Tunnel Down, Site Unreachable, Service Performance, WAN Utilization, Connected Clients, Wi-Fi Issues, Port Errors, SLA Profiles, etc. (Note: Network Utilization and WAN Utilization are the same category - use WAN Utilization only)

${slaInstruction}

5. CRITICAL: For Wi-Fi Issues, you MUST extract:
   - Error type (association, authentication, DHCP, roaming, etc.)
   - Number of errors (not occurrences - these are separate metrics)
   - Number of impacted clients
   - ALWAYS include the Access Point (AP) / Device Name (e.g., North 203, Unit 1604)
   - Format: "Site [SITE_NAME] device [DEVICE_NAME] experienced [ERROR_COUNT] [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Include error_type, error_count, impacted_clients, and device_name fields
   - ONLY include Wi-Fi Issues if they actually appear in the PDF content
   - Sort so the top offending devices appear first

6. CRITICAL: For Port Errors, you MUST extract:
   - Site, Device, Port number, and Port Info
   - In (Avg/Max) error percentages from the table
   - Out (Avg/Max) error percentages from the table
   - Format: "Site [DEVICE] port [PORT] experienced In: X%/Y% Out: A%/B% error rates"
   - Include port_name, in_avg_error, in_max_error, out_avg_error, out_max_error fields
   - Sort so the ports with highest error rates appear first
   - ONLY include Port Errors if they actually appear in the PDF content

7. CRITICAL: For WAN Utilization events, extract In/Out percentages separately. Format: "Site [SITE_NAME] device [DEVICE_NAME] interface [INTERFACE_NAME] experienced WAN utilization In: [IN_PERCENTAGE]% Out: [OUT_PERCENTAGE]% affecting [SERVICES]"
   - Extract separate In and Out utilization percentages 
   - Include in_utilization_percentage, out_utilization_percentage fields
   - Determine trend for In and Out separately (e.g., stable In but increasing Out)
   - DO NOT include last_occurrence for WAN Utilization events
   - SPECIAL HANDLING: If utilization is over 150%, add comment "Note: Utilization over 150% typically indicates a duplex mismatch or measurement error"
   - ONLY include WAN Utilization if it actually appears in the PDF content

8. For each event, provide:
   - Site name
   - Device name (if applicable)
   - Interface name (if applicable)
   - Application name (for Service Performance events, from SLA data)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (major_issue, minor_issue) - DO NOT use "critical_issue"
   - Business hours impact (YES/NO) - ONLY set to YES if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00. If only date is available without time (e.g., "08/30/2025" without time), set to NO. If timestamp shows time outside 09:00-18:00, set to NO.
   - Last occurrence date with time (last_occurrence) - ALWAYS include time if available in format "MM/DD/YYYY HH:MM"
   - Trend (worsening_trend, improving_trend, stable_trend)
   - For Wi-Fi events: error_type, error_count, impacted_clients, device_name
   - Summary line should include: site, device/interface, occurrences, duration, and application name if applicable

9. SEVERITY RULES (Report Summary):
   - DO NOT use "Critical" severity for any category
   - "Major" is the highest severity level
   - For Connected Clients: Mark as "Major" if deviation ≥ 20%, otherwise "Minor" or unmarked
   - For Wi-Fi Issues: Mark device with highest error count as "Major", others as "Minor"
   - For Interface Down Events: Use "Major" or "Minor" based on impact
   - For all other categories: Use existing severity logic but never "Critical"

10. Business hours are 09:00-18:00 local time
11. All timestamps are in UTC - convert to ${timezone} timezone
12. Provide comprehensive business hours analysis
13. Include specific recommendations

OUTPUT FORMAT (JSON):
{
  "categories": [
    {
      "category_name": "Category Name",
      "findings": [ // EXTRACT ALL EVENTS FROM TABLE - NOT JUST 3
        {
          "summary_line": "Brief description of the issue",
          "severity": "critical_issue|major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY HH:MM (include time if available in the PDF)",
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
2. For each category, extract up to 8-12 events from the table (more than 3 but not unlimited)
   CRITICAL: Extract 5-12 events per table to show realistic counts while keeping response manageable
3. Include ALL categories found: Interface Down Events, Device Availability, VPN Tunnel Down, Site Unreachable, Service Performance, WAN Utilization, Connected Clients, Wi-Fi Issues, Port Errors, SLA Profiles, etc. (Note: Network Utilization and WAN Utilization are the same category - use WAN Utilization only). IMPORTANT: DO NOT include "Device Alerting" category - ignore it completely if found in the PDF.

${slaInstruction}

5. CRITICAL: For Wi-Fi Issues, you MUST extract:
   - Error type (association, authentication, DHCP, roaming, etc.)
   - Number of errors (not occurrences - these are separate metrics)
   - Number of impacted clients
   - ALWAYS include the Access Point (AP) / Device Name (e.g., North 203, Unit 1604)
   - Format: "Site [SITE_NAME] device [DEVICE_NAME] experienced [ERROR_COUNT] [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Include error_type, error_count, impacted_clients, and device_name fields
   - Sort so the top offending devices appear first

6. CRITICAL: For Port Errors, you MUST extract:
   - Site, Device, Port number, and Port Info
   - In (Avg/Max) error percentages from the table
   - Out (Avg/Max) error percentages from the table
   - Format: "Site [DEVICE] port [PORT] experienced In: X%/Y% Out: A%/B% error rates"
   - Include port_name, in_avg_error, in_max_error, out_avg_error, out_max_error fields
   - Sort so the ports with highest error rates appear first

7. CRITICAL: For WAN Utilization events, extract In/Out percentages separately. Format: "Site [SITE_NAME] device [DEVICE_NAME] interface [INTERFACE_NAME] experienced WAN utilization In: [IN_PERCENTAGE]% Out: [OUT_PERCENTAGE]% affecting [SERVICES]"
   - Extract separate In and Out utilization percentages 
   - Include in_utilization_percentage, out_utilization_percentage fields
   - Determine trend for In and Out separately (e.g., stable In but increasing Out)
   - DO NOT include last_occurrence for WAN Utilization events
   - SPECIAL HANDLING: If utilization is over 150%, add comment "Note: Utilization over 150% typically indicates a duplex mismatch or measurement error"

8. For each event, provide:
   - Site name
   - Device name (if applicable)
   - Interface name (if applicable)
   - Application name (for Service Performance events, from SLA data)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (major_issue, minor_issue) - DO NOT use "critical_issue"
   - Business hours impact (YES/NO) - ONLY set to YES if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00. If only date is available without time (e.g., "08/30/2025" without time), set to NO. If timestamp shows time outside 09:00-18:00, set to NO.
   - Last occurrence date with time (last_occurrence) - ALWAYS include time if available in format "MM/DD/YYYY HH:MM"
   - Trend (worsening_trend, improving_trend, stable_trend)
   - For Wi-Fi events: error_type, error_count, impacted_clients, device_name
   - Summary line should include: site, device/interface, occurrences, duration, and application name if applicable

9. SEVERITY RULES (Report Summary):
   - DO NOT use "Critical" severity for any category
   - "Major" is the highest severity level
   - For Connected Clients: Mark as "Major" if deviation ≥ 20%, otherwise "Minor" or unmarked
   - For Wi-Fi Issues: Mark device with highest error count as "Major", others as "Minor"
   - For Interface Down Events: Use "Major" or "Minor" based on impact
   - For all other categories: Use existing severity logic but never "Critical"

10. Business hours are 09:00-18:00 local time
11. All timestamps are in UTC - convert to ${timezone} timezone
12. Provide comprehensive business hours analysis
13. Include specific recommendations

OUTPUT FORMAT (JSON):
{
  "categories": [
    {
      "category_name": "Category Name",
      "findings": [ // EXTRACT ALL EVENTS FROM TABLE - NOT JUST 3
        {
          "summary_line": "Brief description of the issue",
          "severity": "major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY HH:MM (include time if available in the PDF)",
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
    max_tokens: 6000,
    temperature: 0.1
  });

  const responseText = completion.choices[0]?.message?.content || '';
  
  if (!responseText) {
    throw new Error('No response from OpenAI for chunk analysis');
  }
  
  // Extract JSON from response with better error handling
  let jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ No JSON found in chunk response. Full response:', responseText);
    throw new Error('No valid JSON found in OpenAI response for chunk analysis');
  }
  
  let analysis;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      analysis = JSON.parse(jsonMatch[0]);
      break; // Success, exit the loop
    } catch (parseError) {
      attempts++;
      console.error(`❌ JSON parse attempt ${attempts} failed for chunk:`, parseError.message);
      
      if (attempts >= maxAttempts) {
        console.error('❌ JSON content length:', jsonMatch[0].length);
        console.error('❌ JSON parse error for chunk:', parseError.message);
        
        // Try to salvage partial data by truncating at the error position
        try {
          const errorPos = parseError.message.match(/position (\d+)/);
          if (errorPos) {
            const pos = parseInt(errorPos[1]);
            let truncatedJson = jsonMatch[0].substring(0, pos);
            
            // Try to close the JSON properly
            const openBraces = (truncatedJson.match(/\{/g) || []).length;
            const closeBraces = (truncatedJson.match(/\}/g) || []).length;
            const openBrackets = (truncatedJson.match(/\[/g) || []).length;
            const closeBrackets = (truncatedJson.match(/\]/g) || []).length;
            
            // Add missing closing brackets/braces
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              truncatedJson += ']';
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
              truncatedJson += '}';
            }
            
            console.log(`🔧 Attempting to salvage truncated JSON for chunk (${truncatedJson.length} chars)`);
            analysis = JSON.parse(truncatedJson);
            console.log(`✅ Successfully parsed truncated JSON with ${analysis.categories?.length || 0} categories`);
            break;
          }
        } catch (salvageError) {
          console.error('❌ Could not salvage chunk JSON:', salvageError.message);
        }
        
        throw new Error(`JSON parsing failed after ${maxAttempts} attempts for chunk: ${parseError.message}`);
      }
      
      // Try to fix common JSON issues
      let jsonText = jsonMatch[0];
      
      // Fix trailing commas in arrays
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix missing closing brackets/braces
      const openBraces = (jsonText.match(/\{/g) || []).length;
      const closeBraces = (jsonText.match(/\}/g) || []).length;
      const openBrackets = (jsonText.match(/\[/g) || []).length;
      const closeBrackets = (jsonText.match(/\]/g) || []).length;
      
      // Add missing closing brackets/braces
      if (openBrackets > closeBrackets) {
        jsonText += ']'.repeat(openBrackets - closeBrackets);
      }
      if (openBraces > closeBraces) {
        jsonText += '}'.repeat(openBraces - closeBraces);
      }
      
      jsonMatch = [jsonText];
    }
  }
  
  return analysis;
}

// Enhanced PDF analysis using OpenAI for comprehensive data extraction
async function analyzePDFContent(pdfBuffer, fileName, timezone = 'UTC') {
  console.log(`📄 Processing ${fileName} with OpenAI-powered analysis`);
  
  // DISABLED: New parser is broken and producing garbage output
  // const useNewParser = process.env.PARSER_PAGE_MODE === '1';
  
  // if (useNewParser) {
  //   try {
  //     console.log('🔧 Using new PDF parser system...');
  //     const { analyzePDFWithNewParser } = require('./lib/analyzer');
  //     const newResult = await analyzePDFWithNewParser(pdfBuffer, fileName, timezone);
  //     
  //     console.log('🔧 New parser result:', {
  //       categoriesCount: newResult.categories?.length || 0,
  //       findingsCount: newResult.findings?.length || 0,
  //       reportType: newResult.report_metadata?.report_type
  //     });
  //     
  //     // Convert to existing format for compatibility
  //     const result = {
  //       report_metadata: {
  //         customer_name: newResult.report_metadata?.customer_name || fileName.split('-')[0] || 'Unknown',
  //         report_title: newResult.report_metadata?.report_title || 'Network Analysis Report',
  //         reporting_period_start: '2025-08-26T00:00:00.000Z',
  //         reporting_period_end: '2025-09-02T23:59:59.999Z',
  //         customer_timezone: timezone,
  //         humanized_intro: generateHumanizedIntro(newResult.categories || [])
  //       },
  //       categories: newResult.categories || [],
  //       business_hours_analysis: generateBusinessHoursAnalysis(newResult.categories || []),
  //       top3_per_category: getTop3FindingsPerCategory(newResult.categories || []),
  //       enhanced_insights: null
  //     };
  //     
  //     // Generate structured recommendations using existing system
  //     const { generateStructuredRecommendations } = require('./structuredRecommendations');
  //     result.recommendations = await generateStructuredRecommendations(newResult.categories || [], fileName);
  //     
  //     console.log('✅ New parser completed successfully');
  //     console.log('🔧 Final result:', {
  //       categoriesCount: result.categories?.length || 0,
  //       totalEvents: result.business_hours_analysis?.total_events || 0
  //     });
  //     
  //     return result;
  //     
  //   } catch (error) {
  //     console.error('❌ New parser failed, falling back to original system:', error.message);
  //     console.error('Stack trace:', error.stack);
  //     // Continue with original system
  //   }
  // }
  
  // Original analysis system (unchanged)
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
    
    console.log('🔧 PDF length:', pdfText.length, 'Max chars:', maxChars);
    
    if (pdfText.length > maxChars) {
      console.log(`📄 PDF is large (${pdfText.length} chars), processing in chunks...`);
      console.log('🔧 Taking CHUNKED processing path');
      
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
        
        // Store total count BEFORE limiting to 3 events
        category.total_findings_count = category.findings.length;
        console.log(`📊 ${category.category_name}: total_findings_count = ${category.total_findings_count}`);
        
        // Calculate total trend counts from ALL findings before limiting
        category.total_trend_counts = {
            worsening_trend: category.findings.filter(f => f.trend === 'worsening_trend').length,
            improving_trend: category.findings.filter(f => f.trend === 'improving_trend').length,
            stable_trend: category.findings.filter(f => f.trend === 'stable_trend').length
        };
        
        // Take exactly 3 most critical events per category
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
            // Wi-Fi events should show device name, error type, error count, and client impact
            const deviceName = finding.device_name || 'Unknown Device';
            const errorType = finding.error_type || 'connectivity';
            const errorCount = finding.error_count || 0;
            const clientCount = finding.impacted_clients || 0;
            
            // Format: "Site [DEVICE_NAME] experienced [ERROR_TYPE] errors (ERROR_COUNT errors affecting CLIENT_COUNT clients)"
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
            // Port errors should show detailed In/Out error rates
            const portName = finding.port_name || 'Unknown Port';
            const inAvg = finding.in_avg_error || 0;
            const inMax = finding.in_max_error || 0;
            const outAvg = finding.out_avg_error || 0;
            const outMax = finding.out_max_error || 0;
            
            // Format: "Site [DEVICE] port [PORT] experienced In: X%/Y% Out: A%/B% error rates"
            parts.push(`port ${portName} experienced In: ${inAvg.toFixed(2)}%/${inMax.toFixed(2)}% Out: ${outAvg.toFixed(2)}%/${outMax.toFixed(2)}% error rates`);
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
      
      // Apply new severity rules and formatting for Report Summary
      combinedCategories.forEach(category => {
        if (category.findings) {
          category.findings.forEach(finding => {
            // Remove "critical_issue" severity - convert to "major_issue"
            if (finding.severity === 'critical_issue') {
              finding.severity = 'major_issue';
            }
            
            // Apply specific severity rules for Connected Clients
            if (category.category_name.toLowerCase().includes('connected clients')) {
              // Extract deviation percentage from summary line or trend
              const deviationMatch = finding.summary_line.match(/(-?\d+)%/);
              if (deviationMatch) {
                const deviation = Math.abs(parseInt(deviationMatch[1]));
                finding.severity = deviation >= 20 ? 'major_issue' : 'minor_issue';
              }
            }
            
            // Apply specific severity rules for Wi-Fi Issues
            if (category.category_name.toLowerCase().includes('wi-fi') || category.category_name.toLowerCase().includes('wifi')) {
              // This will be handled by sorting - highest error count gets "major_issue"
              // The AI prompt will handle the sorting and severity assignment
            }
            
            // Apply specific severity rules for Interface Down Events
            if (category.category_name.toLowerCase().includes('interface down')) {
              // Use "major_issue" for interface down events as they are typically impactful
              finding.severity = 'major_issue';
            }
          });
        }
        
        // Post-processing: Validate and fix incomplete AI extraction
        // Fix Wi-Fi Issues if AI extraction is incomplete
        if (category.category_name.toLowerCase().includes('wi-fi') || category.category_name.toLowerCase().includes('wifi')) {
          if (category.findings && category.findings.length > 0) {
            category.findings.forEach(finding => {
              // Check if AI extraction is incomplete
              if (!finding.error_type || !finding.error_count || !finding.impacted_clients) {
                console.log('⚠️ Wi-Fi Issues: AI extraction incomplete, attempting to fix...');
                
                // Try to extract from summary line
                const summaryLine = finding.summary_line || '';
                
                // Extract error type from summary line
                if (!finding.error_type) {
                  const errorTypeMatch = summaryLine.match(/(association|authentication|dhcp|roaming|connectivity)/i);
                  finding.error_type = errorTypeMatch ? errorTypeMatch[1].toLowerCase() : 'connectivity';
                }
                
                // Extract error count from summary line
                if (!finding.error_count) {
                  const errorCountMatch = summaryLine.match(/(\d+)\s*errors?/i);
                  finding.error_count = errorCountMatch ? parseInt(errorCountMatch[1]) : 0;
                }
                
                // Extract impacted clients from summary line
                if (!finding.impacted_clients) {
                  const clientMatch = summaryLine.match(/(\d+)\s*clients?/i);
                  finding.impacted_clients = clientMatch ? parseInt(clientMatch[1]) : 0;
                }
                
                // Update summary line if it's generic
                if (summaryLine.includes('experienced wi-fi issues') || summaryLine.includes('experienced wifi issues')) {
                  finding.summary_line = `${finding.site_name} ${finding.device_name || 'Unknown Device'} experienced ${finding.error_type} errors (${finding.error_count} errors affecting ${finding.impacted_clients} clients)`;
                }
              }
            });
          }
        }
        
        // Fix Port Errors if AI extraction is incomplete
        if (category.category_name.toLowerCase().includes('port error')) {
          if (category.findings && category.findings.length > 0) {
            category.findings.forEach(finding => {
              // Check if AI extraction is incomplete
              if (!finding.port_name || !finding.in_avg_error || !finding.in_max_error || !finding.out_avg_error || !finding.out_max_error) {
                console.log('⚠️ Port Errors: AI extraction incomplete, attempting to fix...');
                
                // Try to extract from summary line
                const summaryLine = finding.summary_line || '';
                
                // Extract port name from summary line
                if (!finding.port_name) {
                  const portMatch = summaryLine.match(/port\s+([^\s]+)/i);
                  finding.port_name = portMatch ? portMatch[1] : 'Unknown Port';
                }
                
                // Extract error rates from summary line
                if (!finding.in_avg_error || !finding.in_max_error || !finding.out_avg_error || !finding.out_max_error) {
                  const inMatch = summaryLine.match(/In:\s*([\d.]+)%\/([\d.]+)%/i);
                  const outMatch = summaryLine.match(/Out:\s*([\d.]+)%\/([\d.]+)%/i);
                  
                  if (inMatch) {
                    finding.in_avg_error = parseFloat(inMatch[1]);
                    finding.in_max_error = parseFloat(inMatch[2]);
                  } else {
                    finding.in_avg_error = 0;
                    finding.in_max_error = 0;
                  }
                  
                  if (outMatch) {
                    finding.out_avg_error = parseFloat(outMatch[1]);
                    finding.out_max_error = parseFloat(outMatch[2]);
                  } else {
                    finding.out_avg_error = 0;
                    finding.out_max_error = 0;
                  }
                }
                
                // Update summary line if it's generic
                if (summaryLine.includes('unknown% error rate') || summaryLine.includes('experienced port errors')) {
                  finding.summary_line = `${finding.site_name} ${finding.device_name || 'Unknown Device'} port ${finding.port_name} experienced In: ${finding.in_avg_error.toFixed(2)}%/${finding.in_max_error.toFixed(2)}% Out: ${finding.out_avg_error.toFixed(2)}%/${finding.out_max_error.toFixed(2)}% error rates`;
                }
              }
            });
          }
        }
        
        // Special handling for Wi-Fi Issues: Sort by error count and limit to top 3
        if (category.category_name.toLowerCase().includes('wi-fi') || category.category_name.toLowerCase().includes('wifi')) {
          if (category.findings && category.findings.length > 0) {
            // Store total count before limiting
            category.total_findings_count = category.findings.length;
            
            // Sort by error count (highest first)
            category.findings.sort((a, b) => {
              const errorCountA = a.error_count || 0;
              const errorCountB = b.error_count || 0;
              return errorCountB - errorCountA;
            });
            
            // Limit to top 3 devices
            category.findings = category.findings.slice(0, 3);
            
            // Apply severity based on ranking (highest error count = major_issue)
            category.findings.forEach((finding, index) => {
              if (index === 0 && (finding.error_count || 0) > 0) {
                finding.severity = 'major_issue';
              } else {
                finding.severity = 'minor_issue';
              }
            });
            
            console.log(`📊 Wi-Fi Issues: Limited to top 3 devices with highest error counts (total: ${category.total_findings_count})`);
          }
        }
        

        
        // Special handling for Port Errors: Sort by highest error rate and limit to top 3
        if (category.category_name.toLowerCase().includes('port error')) {
          if (category.findings && category.findings.length > 0) {
            // Store total count before limiting
            category.total_findings_count = category.findings.length;
            
            // Sort by highest error rate (highest first)
            category.findings.sort((a, b) => {
              const errorRateA = a.error_rate_percentage || 0;
              const errorRateB = b.error_rate_percentage || 0;
              return errorRateB - errorRateA;
            });
            
            // Limit to top 3 ports
            category.findings = category.findings.slice(0, 3);
            
            // Apply severity based on ranking (highest error rate = major_issue)
            category.findings.forEach((finding, index) => {
              if (index === 0 && (finding.error_rate_percentage || 0) > 0) {
                finding.severity = 'major_issue';
              } else {
                finding.severity = 'minor_issue';
              }
            });
            
            console.log(`📊 Port Errors: Limited to top 3 ports with highest error rates (total: ${category.total_findings_count})`);
          }
        }
      });
      
      // AVI-SPL processing will be applied to all events after chunk aggregation
      
      // Apply Signature Aviation processing if detected (BEFORE summary line generation)
      // Note: This is now handled later in the allEventsFromChunks processing to avoid duplication
      
      // Create business hours analysis
      const totalEvents = combinedCategories.reduce((sum, cat) => sum + cat.findings.length, 0);
      
      // Count ALL events from the original analysis, not just the 3 shown per category
      let allEventsFromChunks = allCategories.flatMap(cat => cat.findings || []);
      
      // Debug: Log VPN Tunnel Down events specifically
      const vpnTunnelEvents = allEventsFromChunks.filter(e => 
        e.summary_line && e.summary_line.toLowerCase().includes('vpn tunnel')
      );
      console.log(`🔍 VPN Tunnel Down events found: ${vpnTunnelEvents.length}`);
      vpnTunnelEvents.forEach(e => {
        console.log(`  - ${e.summary_line.substring(0, 80)}... | timestamp: "${e.last_occurrence}" | business_hours_impact: ${e.business_hours_impact}`);
      });
      
      // Debug: Log ALL events with their timestamps
      console.log(`🔍 ALL EVENTS DEBUG:`);
      allEventsFromChunks.forEach((e, idx) => {
        console.log(`  ${idx + 1}. "${e.summary_line?.substring(0, 60)}..." | timestamp: "${e.last_occurrence}" | business_hours: ${e.business_hours_impact}`);
      });
      
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
      console.log(`🔍 All events from chunks before filtering:`, allEventsFromChunks.length);
      console.log(`🔍 ALL events with details:`, allEventsFromChunks.map(e => ({ 
        summary: e.summary_line?.substring(0, 80), 
        timestamp: e.last_occurrence,
        business_hours_impact: e.business_hours_impact 
      })));
      
      const allTimestampedEvents = allEventsFromChunks.filter(event => {
        if (!event.last_occurrence) return false;
        // Check if it has time component (HH:MM format) - support multiple formats
        const timePatterns = [
          /\d{1,2}:\d{2}/, // Just time like "15:30"
          /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/, // MM/DD/YYYY HH:MM
          /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}/, // DD/MM/YYYY HH:MM
          /\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}/, // MM-DD-YYYY HH:MM
        ];
        
        const hasTime = timePatterns.some(pattern => pattern.test(event.last_occurrence));
        console.log(`🔍 Timestamp check for "${event.last_occurrence}": ${hasTime} (patterns: ${timePatterns.map(p => p.test(event.last_occurrence)).join(', ')})`);
        
        // SPECIAL DEBUG: Check for Dworkin VPN events specifically
        if (event.summary_line && event.summary_line.includes('Dworkin') && event.summary_line.includes('tunnel')) {
          console.log(`🚨 DWORKIN VPN DEBUG: "${event.summary_line}" | timestamp: "${event.last_occurrence}" | hasTime: ${hasTime} | business_hours_impact: ${event.business_hours_impact}`);
        }
        
        return hasTime;
      });
      const totalAllEvents = allTimestampedEvents.length;
      
      console.log(`📊 Total events found: ${allEventsFromChunks.length}, Timestamped events: ${allTimestampedEvents.length}, Using: ${totalAllEvents}`);
      console.log(`🔍 All timestamped events:`, allTimestampedEvents.map(e => ({ summary: e.summary_line, timestamp: e.last_occurrence })));
      
      // Check if there are any events with business_hours_impact = YES (fallback)
      const eventsWithBusinessHoursFlag = allEventsFromChunks.filter(e => e.business_hours_impact === 'YES');
      console.log(`🔍 Events with business_hours_impact=YES: ${eventsWithBusinessHoursFlag.length}`);
      eventsWithBusinessHoursFlag.forEach(e => console.log(`  - ${e.summary_line?.substring(0, 60)}... | timestamp: "${e.last_occurrence}"`));
      
      // CRITICAL DEBUG: Show business hours analysis creation decision
      console.log(`🔍 BUSINESS HOURS DECISION: totalAllEvents = ${totalAllEvents}, eventsWithBusinessHoursFlag = ${eventsWithBusinessHoursFlag.length}, will create analysis? ${totalAllEvents > 0 || eventsWithBusinessHoursFlag.length > 0}`);
      if (totalAllEvents === 0 && eventsWithBusinessHoursFlag.length === 0) {
        console.log(`❌ Business hours analysis will NOT be created because both totalAllEvents and eventsWithBusinessHoursFlag are 0`);
      }
      
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
        businessHoursEvents = allTimestampedEvents.filter(f => {
          console.log(`🔍 Checking event: "${f.summary_line}" with timestamp: "${f.last_occurrence}"`);
          
          // First check if AI explicitly set business_hours_impact to YES
          if (f.business_hours_impact === "YES") {
            console.log(`✅ AI set business_hours_impact to YES`);
            return true;
          }
          
          // If AI didn't set it, automatically detect based on timestamp
          if (f.last_occurrence && /\d{1,2}:\d{2}/.test(f.last_occurrence)) {
            console.log(`✅ Timestamp has time component: "${f.last_occurrence}"`);
            // Extract time from timestamp (e.g., "13:30" from "09/02/2025 13:30")
            const timeMatch = f.last_occurrence.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hour = parseInt(timeMatch[1]);
              console.log(`✅ Extracted hour: ${hour} from timestamp: "${f.last_occurrence}"`);
              // Business hours are 09:00-18:00 (9 AM to 6 PM)
              if (hour >= 9 && hour < 18) {
                console.log(`✅ Hour ${hour} is during business hours (9-18)`);
                return true;
              } else {
                console.log(`❌ Hour ${hour} is NOT during business hours (9-18)`);
              }
            } else {
              console.log(`❌ Could not extract hour from timestamp: "${f.last_occurrence}"`);
            }
          } else {
            console.log(`❌ Timestamp does not have time component: "${f.last_occurrence}"`);
          }
          return false;
        }).length;
        
        console.log(`🏢 Business hours events detected: ${businessHoursEvents}`);
        
        businessHoursPercentage = totalAllEvents > 0 ? Math.round((businessHoursEvents / totalAllEvents) * 100) : 0;
        
        businessHoursEventsList = allTimestampedEvents
        .filter(f => {
          console.log(`🔍 Filtering event for list: "${f.summary_line}" with timestamp: "${f.last_occurrence}"`);
          
          // First check if AI explicitly set business_hours_impact to YES
          if (f.business_hours_impact === "YES") {
            console.log(`✅ AI set business_hours_impact to YES - including in list`);
            return true;
          }
          
          // If AI didn't set it, automatically detect based on timestamp
          if (f.last_occurrence && /\d{1,2}:\d{2}/.test(f.last_occurrence)) {
            console.log(`✅ Timestamp has time component: "${f.last_occurrence}"`);
            // Extract time from timestamp (e.g., "13:30" from "09/02/2025 13:30")
            const timeMatch = f.last_occurrence.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hour = parseInt(timeMatch[1]);
              console.log(`✅ Extracted hour: ${hour} from timestamp: "${f.last_occurrence}"`);
              // Business hours are 09:00-18:00 (9 AM to 6 PM)
              if (hour >= 9 && hour < 18) {
                console.log(`✅ Hour ${hour} is during business hours (9-18) - including in list`);
                return true;
              } else {
                console.log(`❌ Hour ${hour} is NOT during business hours (9-18)`);
              }
            } else {
              console.log(`❌ Could not extract hour from timestamp: "${f.last_occurrence}"`);
            }
          } else {
            console.log(`❌ Timestamp does not have time component: "${f.last_occurrence}"`);
          }
          return false;
        })
        .map(finding => ({
          event_description: finding.summary_line,
          business_impact: `This event affected business operations during work hours`,
          occurrence_time: finding.last_occurrence,
          duration_minutes: finding.avg_duration_minutes || 0,
          severity: finding.severity
        }));
        
        console.log(`📋 Business hours events list created with ${businessHoursEventsList.length} events`);
      }
      
      
      // Add Signature Aviation specific content
      // Only create business hours analysis object if there are timestamped events OR events with business hours flag
      let businessHoursAnalysis = null;
      if (totalAllEvents > 0 || eventsWithBusinessHoursFlag.length > 0) {
        businessHoursAnalysis = {
          peak_incident_hours: '09:00-17:00',
          no_change_window: '02:00-04:00',
          backup_window: '01:00-03:00',
          total_events: totalAllEvents || 0,
          business_impact_events: businessHoursEvents || 0,
          no_business_hours_events: (totalAllEvents || 0) - (businessHoursEvents || 0),
          business_impact_percentage: businessHoursPercentage || 0,
          business_impact_events_list: businessHoursEventsList || [],
          analysis_note: "Important: This analysis focuses on events with explicit time stamps and might not include all network events."
        };
      }
      
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
        const totalMajorIssues = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.severity === 'major_issue').length || 0), 0);
        const totalMinorIssues = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.severity === 'minor_issue').length || 0), 0);
        const totalWorseningTrends = combinedCategories.reduce((sum, cat) => 
          sum + (cat.findings?.filter(f => f.trend === 'worsening_trend').length || 0), 0);
        
        const topCategory = combinedCategories.reduce((max, cat) => 
          cat.findings?.length > (max.findings?.length || 0) ? cat : max, { category_name: 'Network Issues', findings: [] });
        
        // FILTER OUT EVENTS WITH 0 VALUES AND SORT BY PRIORITY
        console.log('🔧 Filtering out events with 0 values and sorting by priority...');
        
        // Define priority order for categories - CRITICAL EVENTS FIRST
        const priorityOrder = [
          'Site Unreachable',
          'Device Availability', 
          'VPN Tunnel Down',
          'Interface Down',
          'Wi-Fi Issues',
          'Port Errors',
          'Connected Clients',
          'WAN Utilization'
        ];
        
        // Filter and sort categories
        const filteredAndSortedCategories = combinedCategories
          .map(category => {
            // Filter out findings with 0 values - ENHANCED FILTERING
            const validFindings = (category.findings || []).filter(finding => {
              const hasValidOccurrences = (finding.total_occurrences || finding.occurrences || 0) > 0;
              const hasValidErrors = (finding.error_count || finding.errors || 0) > 0;
              const hasValidClients = (finding.impacted_clients || finding.clients || 0) > 0;
              const hasValidErrorRate = (finding.error_rate_percentage || 0) > 0;
              const hasValidDuration = (finding.avg_duration_minutes || finding.duration_minutes || 0) > 0;
              
              // For duration, also check if it's a meaningful value (not just 0)
              const duration = finding.avg_duration_minutes || finding.duration_minutes || 0;
              const hasMeaningfulDuration = duration > 0 && duration < 999999; // Reasonable range
              
              // For Wi-Fi events, require actual error counts (not just occurrences)
              if (category.category_name.toLowerCase().includes('wi-fi') || category.category_name.toLowerCase().includes('wifi')) {
                // Include Wi-Fi events with actual errors OR with meaningful occurrences
                return (hasValidErrors && hasValidErrors > 0) || (hasValidOccurrences && hasValidOccurrences > 0);
              }
              
              // For Port Errors, require actual error rates
              if (category.category_name.toLowerCase().includes('port error')) {
                return hasValidErrorRate && hasValidErrorRate > 0; // Must have actual error rates
              }
              
              // For other categories, keep findings that have at least one meaningful value
              return hasValidOccurrences || hasValidErrors || hasValidClients || hasValidErrorRate || hasMeaningfulDuration;
            });
            
            return {
              ...category,
              findings: validFindings
            };
          })
          .filter(category => category.findings.length > 0) // Remove categories with no valid findings
          .sort((a, b) => {
            // Sort by priority order - CRITICAL EVENTS FIRST
            const aPriority = priorityOrder.findIndex(priority => 
              a.category_name.toLowerCase().includes(priority.toLowerCase())
            );
            const bPriority = priorityOrder.findIndex(priority => 
              b.category_name.toLowerCase().includes(priority.toLowerCase())
            );
            
            // If both have priority, sort by priority order
            if (aPriority !== -1 && bPriority !== -1) {
              return aPriority - bPriority;
            }
            
            // If only one has priority, prioritize it
            if (aPriority !== -1) return -1;
            if (bPriority !== -1) return 1;
            
            // Otherwise sort by number of findings (descending)
            return (b.findings?.length || 0) - (a.findings?.length || 0);
          });
        
        console.log(`✅ Filtered from ${combinedCategories.length} to ${filteredAndSortedCategories.length} categories`);
        console.log(`✅ Removed ${combinedCategories.reduce((sum, cat) => sum + (cat.findings?.length || 0), 0) - filteredAndSortedCategories.reduce((sum, cat) => sum + (cat.findings?.length || 0), 0)} events with 0 values`);

        // Extract important findings for executive summary and recommendations
        const importantFindings = filteredAndSortedCategories.filter(cat => 
          priorityOrder.slice(0, 3).some(priority => 
            cat.category_name.toLowerCase().includes(priority.toLowerCase())
          ) && cat.findings.length > 0
        );
        
        console.log(`🎯 Found ${importantFindings.length} critical categories:`, importantFindings.map(cat => cat.category_name));

        // Generate meaningful executive summary with focus on critical events
        function generateHumanizedIntro(categories, criticalFindings) {
          if (!categories || categories.length === 0) {
            return "No network events were detected in this report.";
          }
          
          const totalEvents = categories.reduce((sum, cat) => sum + (cat.findings?.length || 0), 0);
          const criticalCount = criticalFindings.reduce((sum, cat) => sum + (cat.findings?.length || 0), 0);
          
          if (criticalCount > 0) {
            const criticalTypes = criticalFindings.map(cat => {
              if (cat.category_name.toLowerCase().includes('site unreachable')) return 'site connectivity';
              if (cat.category_name.toLowerCase().includes('device availability')) return 'device availability';
              if (cat.category_name.toLowerCase().includes('vpn tunnel')) return 'VPN connectivity';
              return 'connectivity';
            });
            
            const uniqueTypes = [...new Set(criticalTypes)];
            const criticalDescription = uniqueTypes.length === 1 ? uniqueTypes[0] : 'critical connectivity';
            
            return `This week's analysis identified ${totalEvents} network events, including ${criticalCount} ${criticalDescription} issues that require immediate attention.`;
          } else if (totalEvents > 0) {
            return `Network analysis completed successfully, identifying ${totalEvents} events across ${categories.length} categories.`;
          } else {
            return "Network analysis completed with no significant events detected.";
          }
        }

        const result = {
          report_metadata: {
            reporting_period_start: "01/01/2024",
            reporting_period_end: "01/31/2024",
            humanized_intro: generateHumanizedIntro(filteredAndSortedCategories, importantFindings),
            customer_timezone: timezone
          },
        categories: filteredAndSortedCategories.map(cat => ({
          ...cat,
          // Keep original findings for calculations, but limit display to top 3
          all_findings: cat.findings, // Store all findings before limiting
          findings: cat.findings.slice(0, 3) // Limit display to top 3
        })),
                  // Generate recommendations using the new 3-section framework
          recommendations: (() => {
            const stabilityEnhancements = [];
            const capacityResilience = [];
            const observabilityOptimization = [];
            
            // Step 1: Prioritize critical events first, then detect categories with issues
            const criticalCategories = importantFindings.filter(cat => 
              cat.findings?.some(f => f.trend === 'worsening_trend' || f.trend === 'stable_trend' || f.severity === 'major_issue')
            );
            
            const otherCategoriesWithIssues = filteredAndSortedCategories.filter(cat => 
              !importantFindings.includes(cat) && cat.findings?.some(f => f.trend === 'worsening_trend' || f.trend === 'stable_trend')
            );
            
            // Combine critical categories first, then others
            const categoriesWithIssues = [...criticalCategories, ...otherCategoriesWithIssues];
            
            // Step 2: Map categories to sections - CRITICAL EVENTS FIRST
            categoriesWithIssues.forEach(category => {
              const categoryName = category.category_name.toLowerCase();
              const findings = category.findings || [];
              
                             // CRITICAL EVENTS - Priority recommendations
               if (categoryName.includes('site unreachable')) {
                 const unreachableSites = findings.filter(f => f.severity === 'major_issue');
                 if (unreachableSites.length > 0) {
                   stabilityEnhancements.push(
                     `Implement redundant connectivity paths and automated failover systems to prevent complete site isolation during network outages.`
                   );
                 }
               }
               
               if (categoryName.includes('device availability')) {
                 const unavailableDevices = findings.filter(f => f.severity === 'major_issue');
                 if (unavailableDevices.length > 0) {
                   capacityResilience.push(
                     `Deploy redundant power systems and implement proactive device health monitoring with automated alerting to reduce unplanned downtime.`
                   );
                 }
               }
               
               if (categoryName.includes('vpn tunnel')) {
                 const tunnelIssues = findings.filter(f => f.severity === 'major_issue');
                 if (tunnelIssues.length > 0) {
                   stabilityEnhancements.push(
                     `Establish backup VPN connections and implement load balancing across multiple ISP links to ensure continuous remote access.`
                   );
                 }
               }
              
              // Stability Enhancements
              if (categoryName.includes('interface down') || categoryName.includes('interface')) {
                const recurringIssues = findings.filter(f => f.total_occurrences > 1);
                if (recurringIssues.length > 0) {
                  stabilityEnhancements.push(
                    `Upgrade network cabling infrastructure and implement link aggregation to provide redundancy for critical network interfaces.`
                  );
                }
              }
              
              if (categoryName.includes('wi-fi') || categoryName.includes('wifi')) {
                const authIssues = findings.filter(f => 
                  f.error_type && (f.error_type.toLowerCase().includes('authentication') || f.error_type.toLowerCase().includes('association'))
                );
                if (authIssues.length > 0) {
                  stabilityEnhancements.push(
                    `Implement enterprise-grade Wi-Fi controllers with advanced roaming and load balancing to eliminate authentication and association failures.`
                  );
                }
              }
              
              if (categoryName.includes('port error')) {
                const highErrorRates = findings.filter(f => 
                  f.error_rate_percentage && f.error_rate_percentage > 5
                );
                if (highErrorRates.length > 0) {
                  capacityResilience.push(
                    `Deploy network monitoring tools with automated error detection and implement proactive maintenance schedules to prevent port failures.`
                  );
                }
              }
              
              // Capacity & Resilience
              if (categoryName.includes('connected client') || categoryName.includes('client')) {
                const highPeaks = findings.filter(f => 
                  f.summary_line && f.summary_line.toLowerCase().includes('peak') || 
                  f.summary_line && f.summary_line.toLowerCase().includes('high')
                );
                if (highPeaks.length > 0) {
                  capacityResilience.push(
                    `Client load patterns suggest opportunities for optimizing access point density and load distribution.`
                  );
                }
              }
              
              if (categoryName.includes('wan') || categoryName.includes('utilization')) {
                const highUtilization = findings.filter(f => 
                  f.summary_line && f.summary_line.toLowerCase().includes('utilization') ||
                  f.summary_line && f.summary_line.toLowerCase().includes('congestion')
                );
                if (highUtilization.length > 0) {
                  capacityResilience.push(
                    `High network utilization may indicate value in bandwidth optimization and capacity planning.`
                  );
                }
              }
              
              // REMOVED: Observability & Optimization section completely
            });
            
            // Step 3: Generate final recommendations with soft advisory language and deduplication
            const recommendations = [];
            
            // Remove duplicates from each section
            const uniqueStabilityEnhancements = [...new Set(stabilityEnhancements)];
            const uniqueCapacityResilience = [...new Set(capacityResilience)];
            const uniqueObservabilityOptimization = [...new Set(observabilityOptimization)];
            
            if (uniqueStabilityEnhancements.length > 0) {
              recommendations.push({
                section: "Stability Enhancements",
                items: uniqueStabilityEnhancements
              });
            }
            
            if (uniqueCapacityResilience.length > 0) {
              recommendations.push({
                section: "Capacity & Resilience", 
                items: uniqueCapacityResilience
              });
            }
            
            // REMOVED: Observability & Optimization section completely
            
            // Default recommendations if no specific issues found
            if (recommendations.length === 0) {
              recommendations.push({
                section: "General Network Optimization",
                items: [
                  "Reviewing network infrastructure configurations may reveal optimization opportunities for improved performance and reliability.",
                  "Consider implementing enhanced monitoring practices to provide better visibility into network health and trends.",
                  "Exploring modern networking solutions could help prepare for future growth and changing requirements."
                ]
              });
            }
            
            return recommendations;
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
      console.log('🔧 About to call new functions...');
      
      // Generate business hours text for executive summary
      const businessHoursText = totalAllEvents > 0 ? 
        `${businessHoursPercentage}% of time-stamped events occurred during business impact hours, indicating significant operational impact.` :
        'No timestamped events found for business hours analysis.';
      
      // Generate AI-powered executive summary
      console.log('🔧 Generating AI-powered executive summary...');
      const executiveSummary = await generateExecutiveSummary(combinedCategories, fileName, businessHoursText);
      console.log('✅ Executive summary generated:', executiveSummary.substring(0, 100) + '...');

      // Generate AI-powered structured recommendations
      console.log('🔧 Generating AI-powered structured recommendations...');
      const structuredRecommendations = await generateStructuredRecommendations(combinedCategories, fileName);
      console.log('✅ Structured recommendations generated:', typeof structuredRecommendations === 'string' ? structuredRecommendations.substring(0, 100) + '...' : 'Invalid format');

      // Generate report title and date range
      console.log('🔧 Generating report title and date range...');
      const { customerName, reportTitle, dateRange } = generateReportTitle(fileName);
      console.log('✅ Report title generated:', reportTitle);
      console.log('✅ Customer name:', customerName);
      console.log('✅ Date range:', dateRange.start, 'to', dateRange.end);

      // Update result with new metadata and structured recommendations
      result.report_metadata = {
        customer_name: customerName,
        report_title: reportTitle,
        reporting_period_start: dateRange.start,
        reporting_period_end: dateRange.end,
        humanized_intro: executiveSummary,
        customer_timezone: timezone
      };
      
      // Replace old recommendations with new structured format
      // Ensure recommendations are passed as a string, not wrapped in an array
      result.recommendations = structuredRecommendations;
      
      // Debug: Log the recommendations format
      console.log('🔧 Final recommendations format:', typeof result.recommendations);
      console.log('🔧 Recommendations preview:', result.recommendations.substring(0, 200) + '...');
      console.log('🔧 Full recommendations length:', result.recommendations.length);
      console.log('🔧 First 500 chars:', result.recommendations.substring(0, 500));
      
      return result;
    }
    
    // Create comprehensive prompt for OpenAI
    const prompt = `Analyze this network infrastructure report and extract ALL network issues and events. 

REPORT CONTENT:
${analysisText}

CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. EXTRACT ALL categories that exist as tables in the PDF. DO NOT MISS ANY TABLES. Look for: Interface Down Events, Wi-Fi Issues, Port Errors, Connected Clients, Network Utilization, WAN Utilization, VPN Tunnel Down, Device Availability, Site Unreachable, Service Performance & SLA, etc.

1a. **Service Performance & SLA Integration**:
   - **RENAME CATEGORY**: Use "Service Performance & SLA" as the category name (not "Service Performance Incidents")
   - **EXTRACT SLA DATA**: Look for both "Service Performance" AND "SLA Profiles" tables in the PDF
   - **MATCH DATA**: For each Service Performance event, find the matching row in SLA Profiles table by site/device/interface
   - **EXTRACT SLA NAME**: Get the specific SLA name from the SLA column in SLA Profiles table (e.g., "Google", "Office 365", "Salesforce", "Guest_Internet")
   - **SLA COLUMN EXTRACTION**: For each Service Performance event, look up the corresponding SLA name by matching site/device/interface with SLA Profiles table
   - **FORMAT**: "Site [SITE] device [DEVICE] interface [INTERFACE] experienced [OCCURRENCES] SLA violations for [SLA_NAME] with average duration of [DURATION] minutes"
   - **INCLUDE FIELDS**: Add sla_name, sla_profile, application_name fields to each finding
   - **PRIORITY**: Show Service Performance events with matching SLA data first
   - **FALLBACK**: If no SLA table found, use "application" as generic term
   - **REQUIREMENT**: ONLY include this category if BOTH tables exist in the PDF

2. FOR EACH TABLE: Extract up to 8-12 events per category from the table. If a table has many rows, extract the most critical 8-12 events. This ensures we get more than 3 but keep the response manageable.

3. Business Hours Impact Rules:
   - ONLY set business_hours_impact to "YES" if there's a specific timestamp with time (HH:MM) showing the event occurred between 09:00-18:00
   - If only date is available without time (e.g., "08/30/2025"), set to "NO"
   - Interface Down events typically have NO timestamps, so set business_hours_impact to "NO"

4. Category-Specific Rules:

       **Interface Down Events:**
   - Extract device name and interface name from the table
   - Extract interface number from the interface column (e.g., "Gi1/0/15", "Te1/0/1", "Fa0/1")
   - Format: "Site [SITE_NAME] device [DEVICE_NAME] interface [INTERFACE_NAME] experienced interface down"
   - CRITICAL: The interface number MUST be included in the summary_line format above
   - Include interface_name, device_name, and interface_number fields
   - Sort by number of occurrences (descending)

       **Wi-Fi Issues:**
   - Extract device name (AP name) from the table
   - Extract error type (association, authentication, DHCP, roaming, etc.)
   - Extract number of errors and impacted clients
   - Format: "Site [SITE_NAME] device [DEVICE_NAME] experienced [ERROR_COUNT] [ERROR_TYPE] errors affecting [CLIENT_COUNT] clients"
   - Mark device with highest error count as major_issue
   - Include ALL error types (association, authentication, etc.) - do not filter out authentication errors

       **Port Errors:**
    - Extract device name and interface name from the table
    - Extract error rate percentage from "In (Avg/Max)" or "Out (Avg/Max)" columns - use the MAX value, not Avg
    - Extract direction (input/output) based on which column has the error rate
    - Format: "Site [DEVICE_NAME] interface [INTERFACE_NAME] experienced [ERROR_RATE]% error rate ([DIRECTION] errors)"
    - Extract EXACT percentage from MAX column (e.g., if table shows "In (0.002 / 0.087)", use 0.087)
    - DO NOT use trend as error rate - trend should be based on occurrence patterns

   **Network Utilization:**
   - Show the most occurred events that occurred during business hours
   - Prioritize events with timestamps showing 09:00-18:00

   **WAN Utilization:**
   - Extract separate In and Out utilization percentages from the table
   - Format: "Site [SITE_NAME] device [DEVICE_NAME] interface [INTERFACE_NAME] experienced WAN utilization In: X% Out: Y%"
   - DO NOT include last_occurrence for WAN Utilization events
   - Determine trend for In and Out separately
   - SPECIAL HANDLING: If utilization is over 150%, add comment "Note: Utilization over 150% typically indicates a duplex mismatch or measurement error"

   **VPN Tunnel Down:**
   - Show most occurred events
   - Prefer events during business hours if timestamps are available

   **Connected Clients:**
   - Extract ALL sites from the Connected Clients table (all rows)
   - Use "with maximum connected clients" instead of "with a peak"
   - Include the actual client count from the most recent week column
   - Extract trend percentage from the Trend column

   **Service Performance:**
   - ONLY include if there's an actual Service Performance table in the PDF
   - If no table exists, DO NOT create this category

5. For each event, provide:
   - Site name, device name, interface name (if applicable)
   - Number of occurrences (total_occurrences)
   - Average duration in minutes (avg_duration_minutes)
   - Severity (major_issue, minor_issue) - DO NOT use "critical_issue"
   - Business hours impact (YES/NO) - follow rules in #3
   - Last occurrence date with time (last_occurrence) - ALWAYS include time if available in format "MM/DD/YYYY HH:MM"
   - Trend (worsening_trend, improving_trend, stable_trend) - based on occurrence patterns, not error rates
   - For Wi-Fi events: error_type, error_count, impacted_clients, device_name
   - Summary line should include: site, device/interface, occurrences, duration

6. Business hours are 09:00-18:00 local time
7. All timestamps are in UTC - convert to ${timezone} timezone
8. Include specific recommendations

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
      "findings": [ // EXTRACT ALL EVENTS FROM TABLE - NOT JUST 3
        {
          "summary_line": "Brief description of the issue",
          "severity": "critical_issue|major_issue|minor_issue",
          "trend": "worsening_trend|improving_trend|stable_trend",
          "last_occurrence": "MM/DD/YYYY HH:MM (include time if available in the PDF)",
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

IMPORTANT: Extract ALL tables and ALL events. Do not skip any categories or events. Provide complete analysis. EXCLUDE "Device Alerting" category completely - do not process it even if found in the PDF. For Connected Clients events, use "with maximum connected clients" instead of "with a peak" in the summary line. CRITICAL: Ensure the JSON response is complete and properly closed with all brackets and braces. CRITICAL: Extract total_occurrences as the actual number from the table (e.g., if table shows "87 occurrences", use 87). CRITICAL: Include ALL categories found in the PDF - do not skip any tables. CRITICAL: Extract EVERY SINGLE ROW from each table - if a table has 10 rows, extract all 10 rows, not just 3.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a network infrastructure analyst expert. Extract ALL network issues and events from reports with high accuracy and completeness. CRITICAL: Extract ALL events from each table - do not limit to 3 per category during extraction. Extract every single row from every table. Do not skip any tables or events."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: 12000,
      temperature: 0.1
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }
    
    // Extract JSON from response with better error handling
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in response. Full response:', responseText);
      throw new Error('No valid JSON found in OpenAI response');
    }
    
    let analysis;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
        break; // Success, exit the loop
      } catch (parseError) {
        attempts++;
        console.error(`❌ JSON parse attempt ${attempts} failed:`, parseError.message);
        
        if (attempts >= maxAttempts) {
          console.error('❌ JSON content length:', jsonMatch[0].length);
          console.error('❌ JSON parse error at position:', parseError.message);
          
          // Try to salvage partial data by truncating at the error position
          try {
            const errorPos = parseError.message.match(/position (\d+)/);
            if (errorPos) {
              const pos = parseInt(errorPos[1]);
              let truncatedJson = jsonMatch[0].substring(0, pos);
              
              // Try to close the JSON properly
              const openBraces = (truncatedJson.match(/\{/g) || []).length;
              const closeBraces = (truncatedJson.match(/\}/g) || []).length;
              const openBrackets = (truncatedJson.match(/\[/g) || []).length;
              const closeBrackets = (truncatedJson.match(/\]/g) || []).length;
              
              // Add missing closing brackets/braces
              for (let i = 0; i < openBrackets - closeBrackets; i++) {
                truncatedJson += ']';
              }
              for (let i = 0; i < openBraces - closeBraces; i++) {
                truncatedJson += '}';
              }
              
              console.log(`🔧 Attempting to salvage truncated JSON (${truncatedJson.length} chars)`);
              analysis = JSON.parse(truncatedJson);
              console.log(`✅ Successfully parsed truncated JSON with ${analysis.categories?.length || 0} categories`);
              break;
            }
          } catch (salvageError) {
            console.error('❌ Could not salvage JSON:', salvageError.message);
          }
          
          throw new Error(`JSON parsing failed after ${maxAttempts} attempts: ${parseError.message}`);
        }
        
        // Try to fix common JSON issues
        let jsonText = jsonMatch[0];
        
        // Fix trailing commas in arrays
        jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix missing closing brackets/braces
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const openBrackets = (jsonText.match(/\[/g) || []).length;
        const closeBrackets = (jsonText.match(/\]/g) || []).length;
        
        // Add missing closing brackets/braces
        if (openBrackets > closeBrackets) {
          jsonText += ']'.repeat(openBrackets - closeBrackets);
        }
        if (openBraces > closeBraces) {
          jsonText += '}'.repeat(openBraces - closeBraces);
        }
        
        jsonMatch = [jsonText];
      }
    }
    
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
    
    console.log('🔧 About to call new functions for NON-CHUNKED path...');
    
    // Generate business hours text for executive summary
    const totalEvents = normalizedAnalysis.categories.reduce((sum, cat) => sum + cat.findings.length, 0);
    const businessHoursText = totalEvents > 0 ? 
      `Analysis completed with ${totalEvents} total findings across ${normalizedAnalysis.categories.length} categories.` :
      'No findings extracted from the report.';
    
    // Generate AI-powered executive summary
    console.log('🔧 Generating AI-powered executive summary for non-chunked path...');
    const executiveSummary = await generateExecutiveSummary(normalizedAnalysis.categories, fileName, businessHoursText);
    console.log('✅ Executive summary generated for non-chunked path:', executiveSummary.substring(0, 100) + '...');

    // Generate AI-powered structured recommendations
    console.log('🔧 Generating AI-powered structured recommendations...');
    const structuredRecommendations = await generateStructuredRecommendations(normalizedAnalysis.categories, fileName);
    console.log('✅ Structured recommendations generated successfully');

    // Generate report title and date range
    console.log('🔧 Generating report title and date range for non-chunked path...');
    const { customerName, reportTitle, dateRange } = generateReportTitle(fileName);
    console.log('✅ Report title generated for non-chunked path:', reportTitle);
    console.log('✅ Customer name for non-chunked path:', customerName);
    console.log('✅ Date range for non-chunked path:', dateRange.start, 'to', dateRange.end);

    // Update result with new metadata and structured recommendations
    normalizedAnalysis.report_metadata = {
      customer_name: customerName,
      report_title: reportTitle,
      reporting_period_start: dateRange.start,
      reporting_period_end: dateRange.end,
      humanized_intro: executiveSummary,
      customer_timezone: timezone
    };
    
    // Use the AI-generated structured recommendations
    normalizedAnalysis.recommendations = structuredRecommendations;
    
    // ADD BUSINESS HOURS ANALYSIS FOR NON-CHUNKED PATH
    console.log('🔧 Adding business hours analysis for non-chunked path...');
    
    // CRITICAL: Set total_findings_count for NON-CHUNKED path (for category charts)
    // Since AI keeps limiting to 3 despite instructions, estimate realistic counts
    normalizedAnalysis.categories.forEach(cat => {
      if (!cat.total_findings_count) {
        // AI now extracts all events but JSON might be too large
        let actualCount = cat.findings ? cat.findings.length : 0;
        cat.total_findings_count = actualCount;
        console.log(`📊 NON-CHUNKED ${cat.category_name}: total_findings_count = ${cat.total_findings_count} (AI extracted: ${cat.findings ? cat.findings.length : 0})`);
      }
    });
    
    // Get all events from all categories
    let allEventsFromCategories = normalizedAnalysis.categories.flatMap(cat => cat.findings || []);
    console.log(`🔍 All events from categories: ${allEventsFromCategories.length}`);
    
    // Debug: Log all events with their timestamps
    allEventsFromCategories.forEach((e, idx) => {
      console.log(`  ${idx + 1}. "${e.summary_line?.substring(0, 60)}..." | timestamp: "${e.last_occurrence}" | business_hours: ${e.business_hours_impact}`);
    });
    
    // Check for timestamped events
    const timePatterns = [
      /\d{1,2}:\d{2}/, // Just time like "15:30"
      /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/, // MM/DD/YYYY HH:MM
      /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}/, // DD/MM/YYYY HH:MM
      /\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}/, // MM-DD-YYYY HH:MM
    ];
    
    const timestampedEvents = allEventsFromCategories.filter(event => {
      if (!event.last_occurrence) return false;
      const hasTime = timePatterns.some(pattern => pattern.test(event.last_occurrence));
      console.log(`🔍 NON-CHUNKED Timestamp check for "${event.last_occurrence}": ${hasTime}`);
      return hasTime;
    });
    
    // Check for events with business hours flag
    const eventsWithBusinessHoursFlag = allEventsFromCategories.filter(e => e.business_hours_impact === 'YES');
    console.log(`🔍 NON-CHUNKED Events with business_hours_impact=YES: ${eventsWithBusinessHoursFlag.length}`);
    
    const totalTimestampedEvents = timestampedEvents.length;
    console.log(`📊 NON-CHUNKED Total timestamped events: ${totalTimestampedEvents}, Business hours flagged: ${eventsWithBusinessHoursFlag.length}`);
    
    // Create business hours analysis if we have either timestamped events or business hours flagged events
    if (totalTimestampedEvents > 0 || eventsWithBusinessHoursFlag.length > 0) {
      console.log('✅ Creating business hours analysis for non-chunked path');
      
      // Count business hours events
      const businessHoursEvents = eventsWithBusinessHoursFlag.length;
      const nonBusinessHoursEvents = totalTimestampedEvents - businessHoursEvents;
      const businessHoursPercentage = totalTimestampedEvents > 0 ? Math.round((businessHoursEvents / totalTimestampedEvents) * 100) : 0;
      
      normalizedAnalysis.business_hours_analysis = {
        total_events: totalTimestampedEvents,
        business_impact_events: businessHoursEvents,
        no_business_hours_events: Math.max(0, nonBusinessHoursEvents),
        business_impact_percentage: businessHoursPercentage,
        business_impact_events_list: eventsWithBusinessHoursFlag.slice(0, 5).map(event => ({
          event_description: event.summary_line,
          occurrence_time: event.last_occurrence,
          business_impact: "During business hours (09:00-18:00)",
          duration_minutes: event.avg_duration_minutes || 0,
          severity: event.severity
        })),
        analysis_note: "Important: This analysis focuses on events with explicit time stamps and might not include all network events."
      };
      
      console.log('✅ Business hours analysis created for non-chunked path');
    } else {
      console.log('❌ No business hours analysis created - no timestamped or flagged events');
    }
    
    return normalizedAnalysis;
    
  } catch (error) {
    console.error(`❌ OpenAI analysis error:`, error.message);
    
    // Generate report title even for fallback
    const { customerName, reportTitle, dateRange } = generateReportTitle(fileName);
    
    // Return a meaningful fallback
    return {
      report_metadata: {
        customer_name: customerName,
        report_title: reportTitle,
        reporting_period_start: dateRange.start,
        reporting_period_end: dateRange.end,
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
      console.log('⚠️ Napkin API token not configured');
      return {
        success: false,
        error: 'Napkin API not configured'
      };
    }

    console.log('🚀 Starting Napkin visualization generation...');

    // Step 1: Create the visualization request with better error handling
    let createResponse;
    try {
      createResponse = await axios.post('https://api.napkin.ai/v1/visual', {
      content: prompt,
      style: style,
      format: 'png',
      language: 'en-US'
    }, {
      headers: {
        'Authorization': `Bearer ${NAPKIN_API_TOKEN}`,
        'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
    } catch (createError) {
      console.error('❌ Failed to create Napkin visualization:', createError.message);
      if (createError.response?.status === 429) {
        console.log('⚠️ Rate limited during creation, returning fallback');
        return {
          success: false,
          error: 'Rate limit reached - please try again later'
        };
      }
      throw createError;
    }

    const { id } = createResponse.data;
    console.log(`📊 Created Napkin visualization with ID: ${id}`);

    // Step 2: Poll for completion with improved rate limiting
    const maxAttempts = 20; // Reduced from 30
    const baseDelay = 3000; // Increased from 2000
    let targetFile = null;
    let consecutiveErrors = 0;

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      // Exponential backoff for rate limiting
      const delay = baseDelay * Math.pow(1.2, attempts - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const statusResponse = await axios.get(`https://api.napkin.ai/v1/visual/${id}/status`, {
          headers: {
            'Authorization': `Bearer ${NAPKIN_API_TOKEN}`
          },
          timeout: 10000 // 10 second timeout
        });

        const { status, generated_files } = statusResponse.data;
        consecutiveErrors = 0; // Reset error counter on success

        if (status === 'completed' && generated_files && generated_files.length > 0) {
          targetFile = generated_files[0];
          console.log(`✅ Visualization completed successfully on attempt ${attempts}`);
          break;
        } else if (status === 'failed') {
          console.log('❌ Visualization generation failed');
          throw new Error('Visualization generation failed');
        }

        console.log(`⏳ Status: ${status} (attempt ${attempts}/${maxAttempts})`);
      } catch (error) {
        consecutiveErrors++;
        console.log(`⚠️ Attempt ${attempts} failed: ${error.message}`);
        
        if (error.response?.status === 429) {
          console.log('⚠️ Rate limited, waiting longer...');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          continue;
        }
        
        if (consecutiveErrors >= 3) {
          console.log('❌ Too many consecutive errors, giving up');
          throw new Error('Too many consecutive errors during polling');
        }
        
        // For other errors, continue but log them
        console.log(`⚠️ Non-critical error on attempt ${attempts}: ${error.message}`);
      }
    }

    if (!targetFile) {
      console.log('❌ Visualization generation timed out');
      return {
        success: false,
        error: 'Visualization generation timed out'
      };
    }

    // Step 3: Download the file with retry logic
    let imageResponse;
    const maxDownloadAttempts = 3;
    
    for (let downloadAttempt = 1; downloadAttempt <= maxDownloadAttempts; downloadAttempt++) {
    try {
      imageResponse = await axios.get(targetFile.url, { 
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
      });
        break; // Success, exit retry loop
    } catch (downloadError) {
        console.log(`⚠️ Download attempt ${downloadAttempt} failed: ${downloadError.message}`);
        
        if (downloadAttempt === maxDownloadAttempts) {
          throw downloadError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    console.log('✅ Napkin visualization generated successfully');
    return {
      success: true,
      imageUrl: dataUrl,
      napkinId: id
    };

  } catch (error) {
    console.error('❌ Napkin API error:', error.message);
    
    // Return a more specific error message
    if (error.message.includes('rate limit') || error.message.includes('429')) {
    return {
      success: false,
        error: 'Rate limit reached - please try again later'
      };
    }
    
    return {
      success: false,
      error: `Napkin API error: ${error.message}`
    };
  }
}

// Enhanced analysis endpoint with async file handling
app.post('/api/analyze', upload.array('files', 10), async (req, res) => {
  try {
    console.log('📥 API request received');
    console.log('📋 Request body keys:', Object.keys(req.body));
    console.log('📁 Request files:', req.files ? req.files.length : 'undefined');
    console.log('📋 Request headers:', req.headers['content-type']);
    
    const results = [];
    const files = req.files || [];
    
    if (files.length === 0) {
      console.log('❌ No files found in request');
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





