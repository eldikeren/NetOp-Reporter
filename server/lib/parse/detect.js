// Detect only real tables on a given page by requiring both title AND columns.
function findTableBlockOnPage(pageText, { titleRe, columnsRe, maxWindow = 6000 }) {
  const t = pageText.match(titleRe);
  if (!t) return null;
  const idx = t.index;
  const slice = pageText.slice(idx, idx + maxWindow);
  if (!columnsRe.test(slice)) return null; // title found but no header → not a table
  const m = slice.match(/[\s\S]*?(?=\n{2,}|\n[A-Z][\w\s]{3,}\n|$)/);
  return m ? m[0] : null;
}

// Registry of possible tables (not mandatory; discovered per PDF)
const TABLES = [
  { key:'Interface down events',
    titleRe:/^Interface down events$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Interface\s*\n\s*Info\s*\n\s*Trend\s*\n\s*Avg Duration\s*\n\s*Occurrences/im },
  { key:'Device Availability',
    titleRe:/^Device Availability$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Device Type\s*\n\s*Unreachable Count/im },
  { key:'VPN Tunnel Down anomalies',
    titleRe:/^VPN Tunnel Down anomalies$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Tunnel Name\s*\n\s*Last Occurred/im },
  { key:'Site Unreachable events',
    titleRe:/^Site Unreachable events$/im,
    columnsRe:/Site\s*\n\s*Last Occurred\s*\n\s*Incident ID/im },
  { key:'Service Performance incidents',
    titleRe:/^Service Performance incidents$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Interface\s*\n\s*Last Occurred/im },
  { key:'SLA Profiles',
    titleRe:/^SLA Profiles$/im,
    columnsRe:/SLA\s*\n\s*Site\s*\n\s*Device\s*\n\s*Interface/im },
  { key:'WAN Utilization',
    titleRe:/^WAN Utilization$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Interface\s*\n\s*Trend\s*\n\s*Up Avg/im },
  { key:'Network utilization incidents',
    titleRe:/^Network utilization incidents$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Interface\s*\n\s*Last Occurred/im },
  { key:'Connected clients',
    titleRe:/^Connected clients$/im,
    columnsRe:/Site\s*\n\s*Trend\s*\n\s*Clients Week1/im },
  { key:'Wi-?Fi Issues',
    titleRe:/^Wi-?Fi Issues$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Error Type\s*\n\s*Total/im },
  { key:'Port Errors',
    titleRe:/^Port Errors$/im,
    columnsRe:/Site\s*\n\s*Device\s*\n\s*Port\s*\n\s*Errors/im }
];

// More flexible table detection that looks for key column names
function findTableBlockOnPageFlexible(pageText, { titleRe, columnNames, maxWindow = 6000 }) {
  const t = pageText.match(titleRe);
  if (!t) return null;
  const idx = t.index;
  const slice = pageText.slice(idx, idx + maxWindow);
  
  // Check if at least 1 of the expected column names is present (reduced from 2)
  const foundColumns = columnNames.filter(col => slice.includes(col));
  if (foundColumns.length < 1) {
    // If no expected columns found, but we have the title, still try to capture the block
    // This handles cases where table formats are completely different
    console.log(`   ⚠️ No expected columns found, but capturing block anyway for title`);
  } else {
    console.log(`   ✅ Found columns: ${foundColumns.join(', ')}`);
  }
  
  // Look for the end of the table data - find the next major section or end of content
  // Look for patterns that indicate the end of table data
  const endPatterns = [
    /\n[A-Z][a-z\s]{10,}\n/g,  // Next section header
    /\n\s*\n\s*\n/g,           // Multiple blank lines
    /\nInsights/g,             // Insights section
    /\nRecommendations/g,      // Recommendations section
    /\nExecutive Summary/g,    // Executive Summary section
    /\nTable Of Content/g      // Table of Contents
  ];
  
  let endPos = maxWindow;
  for (const pattern of endPatterns) {
    const match = slice.match(pattern);
    if (match && match.index < endPos) {
      endPos = match.index;
    }
  }
  
  // Capture the full table block including data
  const tableBlock = slice.substring(0, endPos);
  console.log(`   📊 Captured table block: ${tableBlock.length} characters`);
  
  return tableBlock;
}

// Enhanced table definitions with flexible column detection
const FLEXIBLE_TABLES = [
  { 
    key: 'Interface down events',
    titleRe: /^Interface down events$/im,
    columnNames: ['Site', 'Device', 'Interface', 'Info', 'Trend', 'Avg Duration', 'Occurrences']
  },
  { 
    key: 'Device Availability',
    titleRe: /^Device Availability$/im,
    columnNames: ['Site', 'Device', 'Device Type', 'Unreachable Count']
  },
  { 
    key: 'Wi-Fi Issues',
    titleRe: /^Wi-?Fi Issues$/im,
    columnNames: ['Site', 'Device', 'Error Type', 'Total', 'Impacted Clients']
  },
  { 
    key: 'Port Errors',
    titleRe: /^Port Errors$/im,
    columnNames: ['Site', 'Device', 'Port', 'Errors', 'In (Avg/Max)', 'Out (Avg/Max)']
  },
  // Add more flexible patterns for different table formats
  { 
    key: 'Site Unreachable events',
    titleRe: /^Site Unreachable events$/im,
    columnNames: ['Site', 'Last Occurred', 'Incident ID']
  },
  { 
    key: 'Connected clients',
    titleRe: /^Connected clients$/im,
    columnNames: ['Site', 'Trend', 'Clients Week1', 'Clients Week2', 'Clients Week3', 'Clients Week4']
  },
  { 
    key: 'WAN Utilization',
    titleRe: /^WAN Utilization$/im,
    columnNames: ['Site', 'Device', 'Interface', 'Trend', 'Up Avg', 'Down Avg']
  },
  { 
    key: 'Service Performance incidents',
    titleRe: /^Service Performance incidents$/im,
    columnNames: ['Site', 'Device', 'Interface', 'Last Occurred']
  },
  { 
    key: 'Network utilization incidents',
    titleRe: /^Network utilization incidents$/im,
    columnNames: ['Site', 'Device', 'Interface', 'Last Occurred']
  }
];

// Robust multi-page table detection
function detectTablesAcrossPages(pages) {
  const isTableTitle = (line) => {
    return /(Wi[- ]?Fi Issues|Interface down|Port Errors|Connected Clients|Device Availability|Site Unreachable|VPN Tunnel Down|WAN Utilization|Service Performance|Network utilization)/i.test(line);
  };

  const isLikelyRow = (line) => {
    return /\d{2}:\d{2}|\d{1,3}%|\b[A-Z0-9]{4,}\b|\d+\.\d+|\d+\s*min\.|\d+\s*times/.test(line);
  };

  let tables = [];
  let currentTable = null;

  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i].split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (let line of lines) {
      if (isTableTitle(line)) {
        // Finalize previous table if exists
        if (currentTable && currentTable.rows.length > 0) {
          tables.push(currentTable);
        }
        
        // Start new table
        currentTable = {
          title: line.trim(),
          rows: [],
          pageStart: i + 1,
          pageEnd: i + 1,
          rawLines: []
        };
      } 
      else if (currentTable && isLikelyRow(line)) {
        // Always capture as raw data - let mapRow handle parsing
        const row = { 'Raw Data': line };
        row._provenance = { page: i + 1, lineIndex: currentTable.rows.length, snippet: line.slice(0, 240) };
        currentTable.rows.push(row);
        currentTable.pageEnd = i + 1;
        currentTable.rawLines.push(line);
      }
    }
  }

  // Finalize last table
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}

// Legacy function for backward compatibility
function detectTablesPerPage(pages, pageOffset = 0) {
  console.log(`   🔄 Using legacy single-page detection for ${pages.length} pages`);
  return detectTablesAcrossPages(pages);
}

module.exports = { detectTablesPerPage, TABLES, findTableBlockOnPage, FLEXIBLE_TABLES, findTableBlockOnPageFlexible };
