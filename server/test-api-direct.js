const fs = require('fs');
const path = require('path');

async function testNewParserDirect() {
  console.log('🧪 Testing New Parser Directly...');
  
  try {
    // Use an existing file from uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.promises.readdir(uploadsDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = pdfFiles[0]; // Use the first available file
    const pdfPath = path.join(uploadsDir, testFile);
    
    console.log(`📄 Using file: ${testFile}`);
    
    // Read the file as buffer
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    
    // Test the new parser directly
    const { analyzePDFWithNewParser } = require('./lib/analyzer');
    const result = await analyzePDFWithNewParser(pdfBuffer, testFile, 'UTC');
    
    console.log('✅ New Parser Test Results:');
    console.log('📊 Results:');
    console.log(`   • Categories: ${result.categories?.length || 0}`);
    console.log(`   • Total Events: ${result.findings?.length || 0}`);
    console.log(`   • Report Title: ${result.report_metadata?.report_title || 'N/A'}`);
    console.log(`   • Customer: ${result.report_metadata?.customer_name || 'N/A'}`);
    console.log(`   • Report Type: ${result.report_metadata?.report_type || 'N/A'}`);
    
    if (result.categories && result.categories.length > 0) {
      console.log('\n📋 Categories found:');
      result.categories.forEach((category, index) => {
        console.log(`   ${index + 1}. ${category.category_name} - ${category.findings?.length || 0} events`);
        
        // Show sample findings with raw data
        if (category.findings && category.findings.length > 0) {
          const sampleFinding = category.findings[0];
          console.log(`      Sample finding keys: ${Object.keys(sampleFinding).join(', ')}`);
          console.log(`      Raw Data: ${sampleFinding['Raw Data'] ? sampleFinding['Raw Data'].substring(0, 100) : 'None'}`);
          console.log(`      Site: ${sampleFinding.site || 'None'}`);
          console.log(`      Device: ${sampleFinding.device || 'None'}`);
          console.log(`      Interface: ${sampleFinding.interface || 'None'}`);
          console.log(`      Occurrences: ${sampleFinding.occurrences || 'None'}`);
          console.log(`      Error Type: ${sampleFinding.error_type || 'None'}`);
          
          // Show the actual raw data from provenance
          if (sampleFinding._provenance && sampleFinding._provenance.snippet) {
            console.log(`      Raw snippet: ${sampleFinding._provenance.snippet}`);
          }
        }
      });
    }
    
    if (result.findings && result.findings.length > 0) {
      console.log('\n📄 Sample Findings:');
      result.findings.slice(0, 3).forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding.summary_line}`);
        console.log(`      Severity: ${finding.severity} | Site: ${finding.site_name}`);
      });
    }
    
    console.log('\n🎉 New parser test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testNewParserDirect().catch(console.error);
