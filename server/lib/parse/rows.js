function parsePipeTable(block, page) {
  const lines = block.split('\n').map(l => l.trim());
  const headerIdx = lines.findIndex(l => l.includes('|'));
  if (headerIdx < 0) return [];
  
  const cols = lines[headerIdx].split('|').map(c => c.trim());
  const data = [];
  let lineIndex = 0;
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;
    const cells = line.split('|').map(c => c.trim());
    if (cells.length < cols.length) continue;
    
    const row = {};
    cols.forEach((c, idx) => { row[c] = cells[idx]; });
    row._provenance = { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) };
    data.push(row);
  }
  return data;
}

// New function to parse the actual table format found in PDFs
function parseFlexibleTable(block, page) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const data = [];
  let lineIndex = 0;
  
  // Look for ANY data rows - be much more flexible
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip obvious header lines and empty lines
    if (line.includes('Site') && line.includes('Device') && line.includes('Interface')) continue;
    if (line.includes('Interface down events')) continue;
    if (line.includes('The table indicates')) continue;
    if (line.includes('Device') && line.includes('Interface') && line.includes('Info')) continue;
    if (line.includes('Info') && line.includes('Trend') && line.includes('Avg Duration')) continue;
    if (line.includes('Avg Duration') && line.includes('Occurrences')) continue;
    if (line.length < 10) continue; // Reduced minimum length
    
    // Look for the actual data format found in the PDF
    // Pattern: ARVA2001 - South Bell - Arlington VAas1-arva2001-w210616Trunk-24%34 min.3
    const mainPattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})([^0-9]*?)([+-]?\d+%?)(\d+(?:\.\d+)?)?\s*min\.?(\d+)/i;
    const match = line.match(mainPattern);
    
    if (match) {
      const siteCode = match[1];
      const location = match[2];
      const state = match[3];
      const deviceInfo = match[4];
      const trend = match[5];
      const duration = match[6] ? parseFloat(match[6]) : 0;
      const occurrences = parseInt(match[7]);
      
      // Extract device and interface from deviceInfo
      const deviceMatch = deviceInfo.match(/([a-z0-9-]+(?:switch|router|ap|wg|arva))/i) || 
                         deviceInfo.match(/([A-Z0-9]+-[A-Z0-9]+)/i);
      const device = deviceMatch ? deviceMatch[1] : 'Unknown Device';
      
      const interfaceMatch = deviceInfo.match(/(Trunk|Gi\d+\/\d+\/\d+|Fa\d+\/\d+|xDP|Ethernet|Port|wg\d+)/i);
      const interface = interfaceMatch ? interfaceMatch[1] : 'Unknown Interface';
      
      const fullSite = `${siteCode} - ${location} - ${state}`;
      
      const row = {
        Site: fullSite,
        Device: device,
        Interface: interface,
        Trend: trend,
        'Avg Duration': duration,
        Occurrences: occurrences,
        'Last Occurred': 'N/A',
        _provenance: { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) }
      };
      
      data.push(row);
      continue;
    }
    
    // Pattern for Wi-Fi issues: ARVA1900 - 1900 Crystal Dr - ArlNorth_202association12%6828
    const wifiPattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})([^0-9]*?)(association|authentication|dhcp|dns|snr|channel)(\d+%?)(\d+)/i;
    const wifiMatch = line.match(wifiPattern);
    
    if (wifiMatch) {
      const siteCode = wifiMatch[1];
      const location = wifiMatch[2];
      const state = wifiMatch[3];
      const deviceInfo = wifiMatch[4];
      const errorType = wifiMatch[5];
      const trend = wifiMatch[6];
      const occurrences = parseInt(wifiMatch[7]);
      
      const deviceMatch = deviceInfo.match(/([A-Za-z0-9_]+)/);
      const device = deviceMatch ? deviceMatch[1] : 'Unknown Device';
      
      const fullSite = `${siteCode} - ${location} - ${state}`;
      
      const row = {
        Site: fullSite,
        Device: device,
        Interface: 'Wi-Fi',
        'Error Type': errorType,
        Trend: trend,
        Occurrences: occurrences,
        'Last Occurred': 'N/A',
        _provenance: { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) }
      };
      
      data.push(row);
      continue;
    }
    
    // Pattern for site unreachable: ARVA2001 - South Bell - Arlington VA - as2-arva2001-e1816 was unreachable
    const unreachablePattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})\s*-\s*([^0-9]+)\s+was\s+unreachable/i;
    const unreachableMatch = line.match(unreachablePattern);
    
    if (unreachableMatch) {
      const siteCode = unreachableMatch[1];
      const location = unreachableMatch[2];
      const state = unreachableMatch[3];
      const device = unreachableMatch[4];
      
      const fullSite = `${siteCode} - ${location} - ${state}`;
      
      const row = {
        Site: fullSite,
        Device: device,
        Interface: 'Unknown Interface',
        Occurrences: 1,
        'Last Occurred': 'N/A',
        _provenance: { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) }
      };
      
      data.push(row);
      continue;
    }
    
    // Pattern for connected clients: ARVA1900 - 1900 Crystal Dr - Arlington VA-10%4756249625122605
    const clientsPattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})([^0-9]*?)([+-]?\d+%)(\d+)/i;
    const clientsMatch = line.match(clientsPattern);
    
    if (clientsMatch) {
      const siteCode = clientsMatch[1];
      const location = clientsMatch[2];
      const state = clientsMatch[3];
      const trend = clientsMatch[5];
      const clients = parseInt(clientsMatch[6]);
      
      const fullSite = `${siteCode} - ${location} - ${state}`;
      
      const row = {
        Site: fullSite,
        Device: 'Unknown Device',
        Interface: 'Unknown Interface',
        Trend: trend,
        'Clients Weekly': [clients],
        'Last Occurred': 'N/A',
        _provenance: { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) }
      };
      
      data.push(row);
      continue;
    }
    
    // Pattern for port errors: ARVA1900 - 1900 Crystal Dr - Arlington Vr1-arva1900wg117%0 / 024.771 / 75
    const portPattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})([^0-9]*?)(\d+%)(\d+)\s*\/\s*(\d+)/i;
    const portMatch = line.match(portPattern);
    
    if (portMatch) {
      const siteCode = portMatch[1];
      const location = portMatch[2];
      const state = portMatch[3];
      const device = portMatch[4];
      const errorRate = portMatch[5];
      const inErrors = parseInt(portMatch[6]);
      const outErrors = parseInt(portMatch[7]);
      
      const fullSite = `${siteCode} - ${location} - ${state}`;
      
      const row = {
        Site: fullSite,
        Device: device,
        Interface: 'Unknown Interface',
        'Error Rate': errorRate,
        'In Errors': inErrors,
        'Out Errors': outErrors,
        'Last Occurred': 'N/A',
        _provenance: { page, lineIndex: lineIndex++, snippet: line.slice(0, 240) }
      };
      
      data.push(row);
      continue;
    }
  }
  
  return data;
}

module.exports = { parsePipeTable, parseFlexibleTable };
