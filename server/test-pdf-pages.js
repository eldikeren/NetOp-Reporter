const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function testPdfPages() {
  console.log('🧪 Testing PDF Page Information...');
  
  const pdfPath = path.join(__dirname, 'pdf', 'Freedom Leisure_short_executive_report (9).pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found');
    return;
  }
  
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('✅ PDF file loaded');
    
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log('📊 PDF Data Properties:');
    console.log('  - Text length:', pdfData.text?.length || 0);
    console.log('  - Number of pages:', pdfData.numpages || 'Not available');
    console.log('  - Info:', pdfData.info || 'Not available');
    console.log('  - Metadata:', pdfData.metadata || 'Not available');
    console.log('  - Version:', pdfData.version || 'Not available');
    
    // Check if we can access individual pages
    console.log('\n🔍 Checking for page-specific data...');
    
    // Try to get page-specific information
    if (pdfData.numpages) {
      console.log(`📄 PDF has ${pdfData.numpages} pages`);
      
      // Check if we can access individual page text
      for (let i = 1; i <= Math.min(pdfData.numpages, 3); i++) {
        console.log(`📄 Page ${i}: Checking if accessible...`);
      }
    } else {
      console.log('❌ No page count information available');
    }
    
    // Show first 500 characters of text
    console.log('\n📝 First 500 characters of PDF text:');
    console.log(pdfData.text?.substring(0, 500) || 'No text available');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPdfPages();
