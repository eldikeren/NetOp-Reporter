// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { analyzePDFWithNewParser } = require('./lib/analyzer');

async function testAviSplParser() {
  console.log('🧪 Testing AVI-SPL PDF parser...');
  
  try {
    // Find AVI-SPL PDF files
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.promises.readdir(uploadsDir);
    const avisplFiles = files.filter(f => f.toLowerCase().includes('avi-spl') || f.toLowerCase().includes('avispl'));
    
    if (avisplFiles.length === 0) {
      console.log('❌ No AVI-SPL PDF files found in uploads directory');
      console.log('📁 Available files:', files.slice(0, 10));
      return;
    }
    
    const testFile = avisplFiles[0];
    const pdfPath = path.join(uploadsDir, testFile);
    console.log(`📄 Testing with: ${testFile}`);
    
    // Read PDF file
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    
    // Test new parser
    const result = await analyzePDFWithNewParser(pdfBuffer, testFile, 'UTC');
    
    console.log('\n✅ AVI-SPL parser test completed!');
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
    
    if (result.categories.length === 0) {
      console.log('\n⚠️ No categories found - this might indicate:');
      console.log('   1. AVI-SPL reports have different table formats');
      console.log('   2. Tables are not being detected properly');
      console.log('   3. Row parsing patterns need adjustment');
      console.log('   4. The report might not contain expected tables');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testAviSplParser().catch(console.error);
