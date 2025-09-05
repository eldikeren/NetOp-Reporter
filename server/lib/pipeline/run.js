const { detectTablesPerPage } = require('../parse/detect');
const { parsePipeTable, parseFlexibleTable } = require('../parse/rows');
const { hasProvenance, withinPeriod, nonZeroErrors, nonZeroOcc, num } = require('../validate/guards');

// Map table → canonical fields
function mapRow(key, r) {
  console.log(`🔍 mapRow called for category "${key}" with data:`, JSON.stringify(r, null, 2));
  
  // Handle new multi-page table format - these rows already have extracted fields
  // Check for both uppercase and lowercase field names
  if (r.site || r.Site || r.device || r.Device || r.interface || r.Interface) {
    console.log(`✅ Found structured data for ${key}`);
    // This is already a mapped row from the new parser
    return {
      site: r.site || r.Site || 'Unknown Site',
      device: r.device || r.Device || 'Unknown Device',
      interface: r.interface || r.Interface || 'Unknown Interface',
      occurrences: r.occurrences || r.Occurrences || 0,
      last_occurred: r.last_occurred || r['Last Occurred'] || 'N/A',
      trend: r.trend || r.Trend || '0%',
      avg_duration: r.avg_duration || r['Avg Duration'] || 0,
      error_type: r.error_type || r['Error Type'] || 'Unknown',
      impacted_clients: r.impacted_clients || r['Impacted Clients'] || 0,
      _provenance: r._provenance
    };
  }

  // If Raw Data is present, try to parse it manually
  if (r['Raw Data']) {
    const rawData = r['Raw Data'];
    console.log(`🔍 Parsing raw data for category "${key}": ${rawData.substring(0, 100)}...`);

    // Use per-category parsing logic
    let parsedRow = null;
    
    if (key.toLowerCase().includes('interface down')) {
      parsedRow = parseInterfaceDownRow(rawData, r._provenance);
    } else if (key.toLowerCase().includes('wi-fi') || key.toLowerCase().includes('wifi')) {
      parsedRow = parseWifiRow(rawData, r._provenance);
    } else if (key.toLowerCase().includes('port error')) {
      parsedRow = parsePortErrorRow(rawData, r._provenance);
    } else if (key.toLowerCase().includes('site unreachable')) {
      parsedRow = parseSiteUnreachableRow(rawData, r._provenance);
    } else if (key.toLowerCase().includes('connected client')) {
      parsedRow = parseConnectedClientsRow(rawData, r._provenance);
    } else {
      // Generic fallback parsing
      parsedRow = parseGenericRow(rawData, key, r._provenance);
    }
    
    if (parsedRow) {
      console.log(`✅ Successfully parsed row for ${key}:`, parsedRow);
      return parsedRow;
    } else {
      console.warn(`❌ Failed to parse row for ${key}:`, rawData);
      // Return a minimal valid row to prevent crashes
      return {
        site: 'Unknown Site',
        device: 'Unknown Device', 
        interface: 'Unknown Interface',
        occurrences: 0,
        last_occurred: 'N/A',
        trend: '0%',
        avg_duration: 0,
        error_type: 'Unknown',
        impacted_clients: 0,
        _provenance: r._provenance
      };
    }
  }

  // If we get here, we couldn't parse the row
  console.warn(`🧨 Could not map row in category "${key}":`, r);
  return null;
}

// Per-category parsing functions
function parseInterfaceDownRow(rawData, provenance) {
  // Pattern: ARVA2001 - South Bell as1-arva2001-e1516Switch08/20/2025 10:2250%OPEN40.1 min.3
  const pattern = /([A-Z0-9]+)\s*-\s*([^-]+)([^0-9]*?)(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})(\d+%?)([A-Z]+)(\d+(?:\.\d+)?)?\s*min\.?(\d+)/i;
  const match = rawData.match(pattern);
  
  if (match) {
    const siteCode = match[1];
    const location = match[2];
    const deviceInfo = match[3];
    const date = match[4];
    const time = match[5];
    const trend = match[6];
    const status = match[7];
    const duration = match[8] ? parseFloat(match[8]) : 0;
    const occurrences = parseInt(match[9]);
    
    // Extract device and interface from deviceInfo
    const deviceMatch = deviceInfo.match(/([a-z0-9-]+(?:switch|router|ap|wg|arva))/i) || 
                       deviceInfo.match(/([A-Z0-9]+-[A-Z0-9]+)/i);
    const device = deviceMatch ? deviceMatch[1] : 'Unknown Device';
    
    const interfaceMatch = deviceInfo.match(/(Trunk|Gi\d+\/\d+\/\d+|Fa\d+\/\d+|xDP|Ethernet|Port|wg\d+)/i);
    const interface = interfaceMatch ? interfaceMatch[1] : 'Unknown Interface';
    
    const fullSite = `${siteCode} - ${location}`;
    
    console.log(`✅ Parsed Interface Down: ${fullSite} ${device} ${interface} - ${occurrences} occurrences`);
    
    return {
      site: fullSite,
      device: device,
      interface: interface,
      occurrences: occurrences,
      last_occurred: `${date} ${time}`,
      trend: trend,
      avg_duration: duration,
      error_type: 'Interface Down',
      impacted_clients: 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse Interface Down row: ${rawData}`);
  return null;
}

function parseWifiRow(rawData, provenance) {
  console.log(`🔍 Parsing Wi-Fi row: ${rawData}`);
  
  // Enhanced regex to capture complete site names with better handling of edge cases
  const wifiPattern = /([A-Z0-9]+)\s*-\s*([^-]+(?:-[^-]+)*?)([^0-9]*?)(association|authentication|dhcp|dns|snr|channel)(\d+%?)(\d+)/i;
  const match = rawData.match(wifiPattern);
  
  if (match) {
    const [, siteCode, location, deviceInfo, errorType, trend, occurrences] = match;
    const fullSite = `${siteCode} - ${location}`.trim();
    const device = deviceInfo.trim() || 'Unknown Device';
    
    console.log(`✅ Parsed Wi-Fi: ${fullSite} ${device} - ${errorType} errors (${occurrences} occurrences)`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Wi-Fi',
      occurrences: parseInt(occurrences) || 0,
      last_occurred: 'N/A',
      trend: trend || '0%',
      avg_duration: 0,
      error_type: errorType,
      impacted_clients: 0,
      _provenance: provenance
    };
  }
  
  // Try alternative pattern for edge cases
  const altPattern = /([A-Z0-9]+)\s*-\s*([^-]+(?:-[^-]+)*?)([^0-9]*?)(association|authentication|dhcp|dns|snr|channel)(\d+%?)(\d+)/i;
  const altMatch = rawData.match(altPattern);
  
  if (altMatch) {
    const [, siteCode, location, deviceInfo, errorType, trend, occurrences] = altMatch;
    const fullSite = `${siteCode} - ${location}`.trim();
    const device = deviceInfo.trim() || 'Unknown Device';
    
    console.log(`✅ Parsed Wi-Fi (alt): ${fullSite} ${device} - ${errorType} errors (${occurrences} occurrences)`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Wi-Fi',
      occurrences: parseInt(occurrences) || 0,
      last_occurred: 'N/A',
      trend: trend || '0%',
      avg_duration: 0,
      error_type: errorType,
      impacted_clients: 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse Wi-Fi row: ${rawData}`);
  return null;
}

function parsePortErrorRow(rawData, provenance) {
  console.log(`🔍 Parsing Port Error row: ${rawData}`);
  
  // Enhanced regex to capture complete site names and port information
  const portPattern = /([A-Z0-9]+)\s*-\s*([^-]+(?:-[^-]+)*?)([^0-9]*?)(\d+%)(\d+)\s*\/\s*(\d+\.\d+)\s*\/\s*(\d+)/i;
  const match = rawData.match(portPattern);
  
  if (match) {
    const [, siteCode, location, deviceInfo, errorRate, inErrors, outAvg, outMax] = match;
    const fullSite = `${siteCode} - ${location}`.trim();
    const device = deviceInfo.trim() || 'Unknown Device';
    
    console.log(`✅ Parsed Port Error: ${fullSite} ${device} - ${errorRate} error rate`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Port',
      occurrences: 0,
      last_occurred: 'N/A',
      trend: '0%',
      avg_duration: 0,
      error_type: 'Port Error',
      impacted_clients: 0,
      in_avg_error: parseFloat(outAvg) || 0,
      in_max_error: parseFloat(outMax) || 0,
      out_avg_error: parseFloat(outAvg) || 0,
      out_max_error: parseFloat(outMax) || 0,
      _provenance: provenance
    };
  }
  
  // Try alternative pattern for different port error formats
  const altPortPattern = /([A-Z0-9]+)\s*-\s*([^-]+(?:-[^-]+)*?)([^0-9]*?)(\d+%)(\d+)\s*\/\s*(\d+\.\d+)\s*\/\s*(\d+)/i;
  const altMatch = rawData.match(altPortPattern);
  
  if (altMatch) {
    const [, siteCode, location, deviceInfo, errorRate, inErrors, outAvg, outMax] = altMatch;
    const fullSite = `${siteCode} - ${location}`.trim();
    const device = deviceInfo.trim() || 'Unknown Device';
    
    console.log(`✅ Parsed Port Error (alt): ${fullSite} ${device} - ${errorRate} error rate`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Port',
      occurrences: 0,
      last_occurred: 'N/A',
      trend: '0%',
      avg_duration: 0,
      error_type: 'Port Error',
      impacted_clients: 0,
      in_avg_error: parseFloat(outAvg) || 0,
      in_max_error: parseFloat(outMax) || 0,
      out_avg_error: parseFloat(outAvg) || 0,
      out_max_error: parseFloat(outMax) || 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse Port Error row: ${rawData}`);
  return null;
}

function parseSiteUnreachableRow(rawData, provenance) {
  // Pattern: ARVA2001 - South Bell - Arlington VA - as2-arva2001-e1816 was unreachable
  const pattern = /([A-Z0-9]+)\s*-\s*([^-]+)([^0-9]*?)\s+was\s+unreachable/i;
  const match = rawData.match(pattern);
  
  if (match) {
    const siteCode = match[1];
    const location = match[2];
    const device = match[3];
    
    const fullSite = `${siteCode} - ${location}`;
    
    console.log(`✅ Parsed Site Unreachable: ${fullSite} ${device}`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Unknown Interface',
      occurrences: 1,
      last_occurred: 'N/A',
      trend: '0%',
      avg_duration: 0,
      error_type: 'Site Unreachable',
      impacted_clients: 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse Site Unreachable row: ${rawData}`);
  return null;
}

function parseConnectedClientsRow(rawData, provenance) {
  console.log(`🔍 Parsing Connected Clients row: ${rawData}`);
  
  // Pattern to capture complete site names: ARVA1900 - 1900 Crystal Dr - Arlington VA-10%4756249625122605
  const clientPattern = /([A-Z0-9]+)\s*-\s*([^-]+(?:\s*-\s*[^-]+)*?)([^0-9]*?)([+-]?\d+%)(\d+)/i;
  const match = rawData.match(clientPattern);
  
  if (match) {
    const [, siteCode, location, deviceInfo, trend, clientCount] = match;
    const fullSite = `${siteCode} - ${location}`.trim();
    const device = deviceInfo.trim() || 'Unknown Device';
    
    console.log(`✅ Parsed Connected Clients: ${fullSite} ${device} - ${clientCount} clients (${trend} trend)`);
    
    return {
      site: fullSite,
      device: device,
      interface: 'Client Connection',
      occurrences: 0,
      last_occurred: 'N/A',
      trend: trend || '0%',
      avg_duration: 0,
      error_type: 'Unknown',
      impacted_clients: parseInt(clientCount) || 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse Connected Clients row: ${rawData}`);
  return null;
}

function parseGenericRow(rawData, category, provenance) {
  // Generic fallback - try to extract any meaningful data
  const parts = rawData.trim().split(/\s{2,}|\t+/); // split on 2+ spaces or tab
  
  if (parts.length >= 3) {
    const [device, type, count] = parts;
    
    console.log(`✅ Parsed generic row: ${device} ${type} ${count}`);
    
    return {
      site: 'Unknown Site',
      device: device?.trim() || 'Unknown Device',
      interface: 'Unknown Interface',
      occurrences: parseInt(count) || 0,
      last_occurred: 'N/A',
      trend: '0%',
      avg_duration: 0,
      error_type: type?.trim() || 'Unknown',
      impacted_clients: 0,
      _provenance: provenance
    };
  }
  
  console.warn(`❌ Could not parse generic row: ${rawData}`);
  return null;
}

// Build categories from raw parsed rows
function buildCategoriesFromFound(detected, meta) {
  const cats = [];
  
  // Handle new multi-page table format
  if (detected.length > 0 && detected[0].title) {
    // New format: detected is array of table objects with title, headers, rows
    for (const table of detected) {
      console.log(`🔧 Building category: ${table.title} from pages ${table.pageStart}-${table.pageEnd} (${table.rows.length} raw rows)`);
      
      // Map rows to canonical format
      const mapped = [];
      for (const row of table.rows) {
        const parsedRow = mapRow(table.title, row);
        if (parsedRow) {
          mapped.push(parsedRow);
        } else {
          console.warn(`❌ Failed to map row in ${table.title}:`, row);
        }
      }
      
      const filtered = mapped.filter(hasProvenance);
      console.log(`   📊 Mapped: ${mapped.length}, With provenance: ${filtered.length}`);
      
      if (filtered.length > 0) {
        cats.push({ category_name: table.title, findings: filtered });
      }
    }
  } else {
    // Legacy format: detected is array of {key, page, block}
    for (const { key, page, block } of detected) {
      console.log(`🔧 Building category: ${key} from page ${page}`);
      
      // Use flexible parsing for detected tables
      const raw = parseFlexibleTable(block, page);
      console.log(`   📊 Raw parsed: ${raw.length} rows`);
      
      const mapped = [];
      for (const row of raw) {
        const parsedRow = mapRow(key, row);
        if (parsedRow) {
          mapped.push(parsedRow);
        } else {
          console.warn(`❌ Failed to map row in ${key}:`, row);
        }
      }
      
      const filtered = mapped.filter(hasProvenance);
      console.log(`   📊 Mapped: ${mapped.length}, With provenance: ${filtered.length}`);
      
      if (filtered.length > 0) {
        cats.push({ category_name: key, findings: filtered });
      }
    }
  }
  
  console.log(`📊 Built ${cats.length} categories with data`);
  return cats;
}

// Apply global filters once
function applyFiltersOnce(categories, meta) {
  const out = [];
  let droppedZero = 0;
  let droppedPeriod = 0;
  let droppedNoProvenance = 0;
  let kept = 0;

  for (const c of categories) {
    let f = [...c.findings];

    // Apply category-specific filtering (be more intelligent)
    if (c.category_name === 'Port Errors') {
      // For Port Errors, look for error rates or error counts
      const before = f.length;
      f = f.filter(r => {
        const hasErrors = nonZeroErrors(r);
        const hasErrorRate = r['Error Rate'] > 0;
        const hasRawData = r['Raw Data'] && r['Raw Data'].includes('%');
        return hasErrors || hasErrorRate || hasRawData;
      });
      droppedZero += before - f.length;
    }
    else if (['Interface down events','Network utilization incidents','Service Performance incidents','Site Unreachable events','Device Availability'].includes(c.category_name)) {
      // For these categories, look for occurrences or any meaningful data
      const before = f.length;
      f = f.filter(r => {
        const hasOccurrences = nonZeroOcc(r);
        const hasRawData = r['Raw Data'] && r['Raw Data'].length > 10;
        const hasSiteData = r.site && r.site !== 'Unknown Site';
        return hasOccurrences || hasRawData || hasSiteData;
      });
      droppedZero += before - f.length;
    }
    else if (c.category_name === 'Wi-Fi Issues') {
      // For Wi-Fi Issues, look for error types, impacted clients, or any meaningful data
      const before = f.length;
      f = f.filter(r => {
        const hasErrorType = r.error_type && r.error_type !== 'Unknown';
        const hasImpactedClients = r.impacted_clients > 0;
        const hasRawData = r['Raw Data'] && (r['Raw Data'].includes('association') || r['Raw Data'].includes('authentication'));
        const hasSiteData = r.site && r.site !== 'Unknown Site';
        return hasErrorType || hasImpactedClients || hasRawData || hasSiteData;
      });
      droppedZero += before - f.length;
    }
    else if (c.category_name === 'Connected clients') {
      // For Connected clients, look for client counts or trend data
      const before = f.length;
      f = f.filter(r => {
        const hasClients = Array.isArray(r.clients_weekly) && r.clients_weekly.some(c => c > 0);
        const hasTrend = r.trend && r.trend !== '0%';
        const hasRawData = r['Raw Data'] && r['Raw Data'].match(/\d+/);
        const hasSiteData = r.site && r.site !== 'Unknown Site';
        return hasClients || hasTrend || hasRawData || hasSiteData;
      });
      droppedZero += before - f.length;
    }
    else {
      // For any other category, be very permissive - just require some meaningful data
      const before = f.length;
      f = f.filter(r => {
        const hasSiteData = r.site && r.site !== 'Unknown Site';
        const hasRawData = r['Raw Data'] && r['Raw Data'].length > 10;
        const hasAnyData = r.device !== 'Unknown Device' || r.interface !== 'Unknown Interface';
        return hasSiteData || hasRawData || hasAnyData;
      });
      droppedZero += before - f.length;
    }

    // enforce period on rows that have last_occurred
    const before = f.length;
    f = f.filter(x => !x.last_occurred || withinPeriod(x.last_occurred, meta.reporting_period_start, meta.reporting_period_end));
    droppedPeriod += before - f.length;

    // require provenance
    const beforeProv = f.length;
    f = f.filter(hasProvenance);
    droppedNoProvenance += beforeProv - f.length;

    kept += f.length;

    if (f.length) out.push({ ...c, findings: f });
  }

  console.log(`kept=${kept} dropped_zero=${droppedZero} dropped_period=${droppedPeriod} dropped_no_provenance=${droppedNoProvenance}`);
  return out;
}

function dedupeByProvenance(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const k = `${r._provenance?.page}:${r._provenance?.lineIndex ?? ''}:${r._provenance?.snippet}`;
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

// Rank top-3 across all categories (simple, transparent)
function rankTop3AcrossAll(categories) {
  const rank = [];
  for (const c of categories) {
    for (const f of c.findings) {
      let score = 0;
      if (f.occurrences) score += f.occurrences;
      if (f.errors) score += num(f.errors);
      if (Array.isArray(f.clients_weekly)) score += Math.max(...f.clients_weekly) / 500;
      rank.push({ site: f.site, device: f.device, category: c.category_name, score, f });
    }
  }
  rank.sort((a,b)=>b.score-a.score);
  return rank.slice(0,3);
}

module.exports = {
  detectTablesPerPage,
  buildCategoriesFromFound,
  applyFiltersOnce,
  dedupeByProvenance,
  rankTop3AcrossAll
};
