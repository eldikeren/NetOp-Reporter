const {
  detectTablesPerPage,
  buildCategoriesFromFound,
  applyFiltersOnce,
  rankTop3AcrossAll
} = require('./pipeline/run');

// Feature flags (safe rollout)
const FEATURE_FLAGS = {
  PARSER_PAGE_MODE: process.env.PARSER_PAGE_MODE === '1',
  PARSER_NO_FALLBACK: process.env.PARSER_NO_FALLBACK === '1',
  PARSER_REQUIRE_PROVENANCE: process.env.PARSER_REQUIRE_PROVENANCE === '1',
  PARSER_FILTER_ZERO: process.env.PARSER_FILTER_ZERO === '1',
  PARSER_ENFORCE_PERIOD: process.env.PARSER_ENFORCE_PERIOD === '1',
  ANALYSIS_FINALIZE_ONCE: process.env.ANALYSIS_FINALIZE_ONCE === '1'
};

// Priority categories for sorting
const PRIORITY_CATEGORIES = [
  'Site Unreachable events',
  'Device Availability', 
  'VPN Tunnel Down anomalies',
  'Interface down events',
  'Wi-Fi Issues',
  'Port Errors',
  'Connected clients'
];

// Classify report type based on content
function classifyReportType(categories, fileName) {
  const categoryNames = categories.map(c => c.category_name.toLowerCase());
  
  // Check for AVI-SPL specific patterns
  if (fileName.toLowerCase().includes('avi-spl') || 
      fileName.toLowerCase().includes('avispl') ||
      categoryNames.some(name => name.includes('avi'))) {
    return 'AVI-SPL';
  }
  
  // Check for Signature Aviation patterns
  if (fileName.toLowerCase().includes('signature') || 
      fileName.toLowerCase().includes('aviation') ||
      categoryNames.some(name => name.includes('airport') || name.includes('flight'))) {
    return 'Signature Aviation';
  }
  
  // Check for ElauwitSites patterns
  if (fileName.toLowerCase().includes('elauwit') || 
      categoryNames.some(name => name.includes('arva'))) {
    return 'ElauwitSites';
  }
  
  // Default classification based on most common category
  if (categoryNames.some(name => name.includes('wifi') || name.includes('wi-fi'))) {
    return 'Wi-Fi Focused';
  }
  
  if (categoryNames.some(name => name.includes('port') || name.includes('interface'))) {
    return 'Network Infrastructure';
  }
  
  return 'General Network';
}

// Generate human-readable parser diagnostics
function generateParserDiagnostics(categories, rawCount, keptCount, droppedCounts) {
  const diagnostics = [];
  
  diagnostics.push(`📊 Parser Results:`);
  diagnostics.push(`   • Tables detected: ${categories.length}`);
  diagnostics.push(`   • Total events found: ${rawCount}`);
  diagnostics.push(`   • Events in final report: ${keptCount}`);
  
  if (droppedCounts.dropped_zero > 0) {
    diagnostics.push(`   • Events filtered (zero values): ${droppedCounts.dropped_zero}`);
  }
  if (droppedCounts.dropped_period > 0) {
    diagnostics.push(`   • Events filtered (out of period): ${droppedCounts.dropped_period}`);
  }
  if (droppedCounts.dropped_no_provenance > 0) {
    diagnostics.push(`   • Events filtered (no source): ${droppedCounts.dropped_no_provenance}`);
  }
  
  // Category breakdown
  if (categories.length > 0) {
    diagnostics.push(`\n📋 Categories found:`);
    categories.forEach((cat, index) => {
      const priority = PRIORITY_CATEGORIES.indexOf(cat.category_name);
      const priorityIcon = priority >= 0 ? ` (Priority ${priority + 1})` : '';
      diagnostics.push(`   ${index + 1}. ${cat.category_name}${priorityIcon} - ${cat.findings.length} events`);
    });
  }
  
  return diagnostics.join('\n');
}

// Generate report title and date range from filename (copied from index.js)
function generateReportTitle(fileName) {
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
    
    // Generate report title
    const reportTitle = `${customerName} - Network Analysis Report`;
    
    return reportTitle;
    
  } catch (error) {
    console.error('❌ Report title generation error:', error.message);
    return 'Network Analysis Report';
  }
}

async function runUnchunkedPath(pdfPages, meta) {
  console.log('🔧 Running unchunked path with new parser...');
  const detected = detectTablesPerPage(pdfPages, 0);
  return buildCategoriesFromFound(detected, meta);
}

async function runChunkedPath(pdfPages, meta, chunkSize = 12) {
  console.log('🔧 Running chunked path with new parser...');
  const allDetected = [];
  for (let i = 0; i < pdfPages.length; i += chunkSize) {
    const pages = pdfPages.slice(i, i + chunkSize);
    const detected = detectTablesPerPage(pages, i);
    allDetected.push(...detected);
  }
  return buildCategoriesFromFound(allDetected, meta);
}

// Helper functions for compatibility
function generateSummaryLine(finding, categoryName) {
  const site = finding.site || 'Unknown Site';
  const device = finding.device || 'Unknown Device';
  const interface = finding.interface || 'Unknown Interface';
  
  // Generate specific summary lines based on category and available data
  if (categoryName.toLowerCase().includes('wi-fi') || categoryName.toLowerCase().includes('wifi')) {
    const errorType = finding.error_type || 'unknown error';
    const errorCount = finding.occurrences || 0;
    const clientCount = finding.impacted_clients || 0;
    if (errorCount > 0) {
      return `${site} ${device} experienced ${errorType} errors (${errorCount} errors affecting ${clientCount} clients)`;
    } else {
      return `${site} ${device} experienced ${errorType} connectivity issues`;
    }
  }
  
  if (categoryName.toLowerCase().includes('port error')) {
    const portName = finding.interface || 'Unknown Port';
    const inAvg = finding.in_avg_error || 0;
    const inMax = finding.in_max_error || 0;
    const outAvg = finding.out_avg_error || 0;
    const outMax = finding.out_max_error || 0;
    return `${site} ${device} port ${portName} experienced In: ${inAvg.toFixed(2)}%/${inMax.toFixed(2)}% Out: ${outAvg.toFixed(2)}%/${outMax.toFixed(2)}% error rates`;
  }
  
  if (categoryName.toLowerCase().includes('interface down')) {
    const occurrences = finding.occurrences || 0;
    const duration = finding.avg_duration || 0;
    if (occurrences > 0) {
      return `${site} ${device} ${interface} experienced ${occurrences} downtime events (avg ${duration} min)`;
    } else {
      return `${site} ${device} ${interface} experienced connectivity issues`;
    }
  }
  
  if (categoryName.toLowerCase().includes('device availability')) {
    const availability = finding.availability || 0;
    return `${site} ${device} availability: ${availability}%`;
  }
  
  if (categoryName.toLowerCase().includes('connected client')) {
    const clients = finding.impacted_clients || 0;
    if (clients > 0) {
      return `${site} peak concurrent clients: ${clients}`;
    } else {
      return `${site} client connectivity analysis completed`;
    }
  }
  
  if (categoryName.toLowerCase().includes('site unreachable')) {
    const occurrences = finding.occurrences || 0;
    if (occurrences > 0) {
      return `${site} experienced ${occurrences} unreachable events`;
    } else {
      return `${site} experienced connectivity issues`;
    }
  }
  
  // Generic fallback - use the raw snippet if available
  if (finding._provenance && finding._provenance.snippet) {
    const snippet = finding._provenance.snippet;
    if (snippet.length > 50) {
      return `${site} ${device} ${interface} - ${snippet.substring(0, 50)}...`;
    } else {
      return `${site} ${device} ${interface} - ${snippet}`;
    }
  }
  
  return `${site} ${device} ${interface} experienced ${categoryName.toLowerCase()}`;
}

function determineSeverity(finding, categoryName) {
  // Simple severity logic - can be enhanced
  if (categoryName === 'Site Unreachable events') return 'major_issue';
  if (categoryName === 'Device Availability') return 'major_issue';
  if (categoryName === 'VPN Tunnel Down anomalies') return 'major_issue';
  
  const occurrences = finding.occurrences || 0;
  if (occurrences > 5) return 'major_issue';
  if (occurrences > 1) return 'minor_issue';
  
  return 'minor_issue';
}

// Main analysis function with clean output
async function analyzePDFWithNewParser(pdfBuffer, fileName, timezone = 'UTC') {
  console.log(`🔧 Using new PDF parser system...`);
  
  try {
    // Extract text from PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text || '';
    
    console.log(`📊 Extracted ${pdfText.length.toLocaleString()} characters from PDF`);
    console.log(`📄 PDF has ${pdfData.numpages || 'unknown'} pages`);
    
    // Generate report title
    const reportTitle = generateReportTitle(fileName);
    console.log(`🔧 generateReportTitle called with filename: ${fileName}`);
    
    // Simulate page splitting for chunked processing
    const avgPageSize = Math.ceil(pdfText.length / (pdfData.numpages || 1));
    const pages = [];
    for (let i = 0; i < pdfText.length; i += avgPageSize) {
      pages.push(pdfText.substring(i, i + avgPageSize));
    }
    
    console.log(`📄 Split into ${pages.length} simulated pages`);
    
    // Run chunked analysis
    console.log(`🔧 Running chunked path with new parser...`);
    const { detectTablesPerPage, buildCategoriesFromFound, applyFiltersOnce } = require('./pipeline/run');
    
    // Process in chunks
    const chunkSize = 12;
    const allCategories = [];
    let totalRawRows = 0;
    
    for (let i = 0; i < pages.length; i += chunkSize) {
      const chunk = pages.slice(i, i + chunkSize);
      const detected = detectTablesPerPage(chunk, i);
      
      if (detected.length > 0) {
        const meta = {
          reporting_period_start: '2025-08-26T00:00:00.000Z',
          reporting_period_end: '2025-09-02T23:59:59.999Z'
        };
        
        const categories = buildCategoriesFromFound(detected, meta);
        allCategories.push(...categories);
        
        // Count raw rows
        categories.forEach(cat => {
          totalRawRows += cat.findings.length;
        });
      }
    }
    
    // Apply global filters once
    const meta = {
      reporting_period_start: '2025-08-26T00:00:00.000Z',
      reporting_period_end: '2025-09-02T23:59:59.999Z'
    };
    
    const filteredCategories = applyFiltersOnce(allCategories, meta);
    
    // Sort by priority
    filteredCategories.sort((a, b) => {
      const aIdx = PRIORITY_CATEGORIES.indexOf(a.category_name);
      const bIdx = PRIORITY_CATEGORIES.indexOf(b.category_name);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    // Count kept rows
    const keptCount = filteredCategories.reduce((sum, cat) => sum + cat.findings.length, 0);
    
    // Generate diagnostics
    const diagnostics = generateParserDiagnostics(
      filteredCategories, 
      totalRawRows, 
      keptCount,
      { dropped_zero: totalRawRows - keptCount, dropped_period: 0, dropped_no_provenance: 0 }
    );
    
    console.log(diagnostics);
    
    // Classify report type
    const reportType = classifyReportType(filteredCategories, fileName);
    console.log(`\n🏷️ Report Type: ${reportType}`);
    
    // Convert to existing format for compatibility
    const findings = [];
    filteredCategories.forEach(category => {
      category.findings.forEach(finding => {
        findings.push({
          site_name: finding.site || 'Unknown Site',
          device_name: finding.device || 'Unknown Device',
          interface_name: finding.interface || 'Unknown Interface',
          summary_line: generateSummaryLine(finding, category.category_name),
          severity: determineSeverity(finding, category.category_name),
          trend: finding.trend || '➡️ stable trend',
          last_occurrence: finding.last_occurred || 'N/A',
          occurrences: finding.occurrences || 0,
          impacted_clients: finding.impacted_clients || 0,
          error_type: finding.error_type || 'Unknown',
          category: category.category_name
        });
      });
    });
    
    return {
      report_metadata: {
        customer_name: fileName.split('-')[0] || 'Unknown',
        report_title: reportTitle,
        parser_version: '2.0',
        report_type: reportType
      },
      categories: filteredCategories,
      findings: findings,
      feature_flags: FEATURE_FLAGS,
      diagnostics: diagnostics
    };
    
  } catch (error) {
    console.error(`❌ New parser failed: ${error.message}`);
    throw error;
  }
}

module.exports = { analyzePDFWithNewParser, FEATURE_FLAGS };
