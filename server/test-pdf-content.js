const fs = require('fs');
const pdfParse = require('pdf-parse');

async function examinePDFContent() {
  try {
    console.log('🔍 Examining Freedom Leisure PDF content...');
    
    // Read the PDF file
    const pdfBuffer = fs.readFileSync('./pdf/Freedom Leisure_short_executive_report (9).pdf');
    
    // Parse PDF text
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text || '';
    
    console.log(`📊 PDF contains ${pdfText.length} characters`);
    console.log('\n📄 First 2000 characters:');
    console.log('=' .repeat(80));
    console.log(pdfText.substring(0, 2000));
    console.log('=' .repeat(80));
    
    // Look for table headers
    const tableHeaders = [
      'Interface down events',
      'Device Availability', 
      'VPN Tunnel Down anomalies',
      'Site Unreachable events',
      'Service Performance incidents',
      'WAN Utilization',
      'Network utilization incidents',
      'Connected clients',
      'Wi-Fi Issues',
      'Port Errors'
    ];
    
    console.log('\n🔍 Searching for table headers:');
    for (const header of tableHeaders) {
      const index = pdfText.toLowerCase().indexOf(header.toLowerCase());
      if (index !== -1) {
        console.log(`✅ Found "${header}" at position ${index}`);
        // Show context around the header
        const context = pdfText.substring(Math.max(0, index - 50), index + 200);
        console.log(`   Context: "${context.replace(/\n/g, '\\n')}"`);
      } else {
        console.log(`❌ Not found: "${header}"`);
      }
    }
    
    // Look for any table-like patterns
    console.log('\n🔍 Looking for table patterns:');
    const lines = pdfText.split('\n');
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      const line = lines[i].trim();
      if (line.length > 20 && line.includes('  ') && /[A-Z]/.test(line)) {
        console.log(`Line ${i}: "${line}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error examining PDF:', error.message);
  }
}

examinePDFContent();
