// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { analyzePDFWithNewParser } = require('./lib/analyzer');

async function testNewParser() {
  console.log('🧪 Testing new PDF parser system...');
  
  try {
    // Find a test PDF file
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.promises.readdir(uploadsDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = pdfFiles[0];
    const pdfPath = path.join(uploadsDir, testFile);
    console.log(`📄 Testing with: ${testFile}`);
    
    // Read PDF file
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    
    // Test new parser
    const result = await analyzePDFWithNewParser(pdfBuffer, testFile, 'UTC');
    
    console.log('\n✅ New parser test completed successfully!');
    console.log(`📊 Report metadata:`, {
      customer_name: result.report_metadata.customer_name,
      report_title: result.report_metadata.report_title,
      parser_version: result.parser_version
    });
    console.log(`📊 Categories found: ${result.categories.length}`);
    
    // Show category details
    result.categories.forEach((category, index) => {
      console.log(`\n📋 Category ${index + 1}: ${category.category_name}`);
      console.log(`   Findings: ${category.findings.length}`);
      
      if (category.findings.length > 0) {
        const firstFinding = category.findings[0];
        console.log(`   Sample finding: ${firstFinding.summary_line}`);
        console.log(`   Severity: ${firstFinding.severity}`);
        
        // Check for provenance
        if (firstFinding._provenance) {
          console.log(`   ✅ Has provenance: page ${firstFinding._provenance.page}`);
        } else {
          console.log(`   ⚠️ No provenance data`);
        }
      }
    });
    
    // Check feature flags
    console.log('\n🔧 Feature flags status:');
    Object.entries(result.feature_flags).forEach(([flag, enabled]) => {
      console.log(`   ${flag}: ${enabled ? '✅' : '❌'}`);
    });
    
    console.log('\n🎉 New parser system is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testNewParser().catch(console.error);
