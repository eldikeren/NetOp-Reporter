const pdfParse = require('pdf-parse');
const fs = require('fs');

async function testRowDetection() {
  console.log('🔍 Testing row detection...');
  
  const pdfPath = './pdf/Freedom Leisure_short_executive_report (10).pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);
  
  const pdfData = await pdfParse(pdfBuffer);
  const pdfText = pdfData.text || '';
  
  const lines = pdfText.split('\n');
  
  // Find Interface down events section
  let interfaceSection = false;
  let rowCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const normLine = line.toLowerCase();
    
    if (normLine.includes('interface down events')) {
      console.log('✅ Found Interface down events section');
      interfaceSection = true;
      continue;
    }
    
    if (interfaceSection) {
      // Stop if we hit another section
      if (normLine.includes('device availability') || 
          normLine.includes('vpn tunnel') ||
          normLine.includes('site unreachable')) {
        break;
      }
      
      // Check if this looks like a data row
      if (line.length > 10 && !normLine.includes('site') && !normLine.includes('device') && !normLine.includes('interface')) {
        console.log(`\n📊 Potential data row ${++rowCount}:`);
        console.log(`   Raw: "${line}"`);
        console.log(`   Length: ${line.length}`);
        console.log(`   Has site name: ${/[A-Z][a-z]+/.test(line)}`);
        console.log(`   Has numbers: ${/\d+/.test(line)}`);
        console.log(`   Has minutes: ${/\d+\.?\d*\s*min/i.test(line)}`);
        console.log(`   Has percentage: ${/\d+%/.test(line)}`);
        
        // Test our splitRow function
        const parts = splitRow(line);
        console.log(`   Split parts: [${parts.join(', ')}]`);
        console.log(`   Parts count: ${parts.length}`);
        
        if (rowCount >= 5) break; // Show first 5 rows
      }
    }
  }
}

function splitRow(raw) {
  // Handle the special character that appears in the PDF
  const cleaned = raw.replace(/\uF021/g, ' ').replace(/\u00A0/g, ' ').trim();
  return cleaned.split(/\s{2,}|\t+/).map(x => x.trim()).filter(Boolean);
}

testRowDetection().catch(console.error);
