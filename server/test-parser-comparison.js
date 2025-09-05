// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');

async function testParserComparison() {
  console.log('🧪 Testing PDF parser system...');
  
  try {
    // Find any PDF file
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
    
    // Extract text from PDF for basic analysis
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text || '';
    
    console.log(`📊 PDF Analysis:`);
    console.log(`   • Size: ${pdfText.length.toLocaleString()} characters`);
    console.log(`   • Pages: ${pdfData.numpages || 'unknown'}`);
    
    // Test the new parser
    console.log(`\n🔧 Testing new parser system...`);
    const { analyzePDFWithNewParser } = require('./lib/analyzer');
    const result = await analyzePDFWithNewParser(pdfBuffer, testFile, 'UTC');
    
    // Display clean results
    console.log(`\n✅ Parser Test Results:`);
    console.log(`   • Report Type: ${result.report_metadata.report_type}`);
    console.log(`   • Categories Found: ${result.categories.length}`);
    console.log(`   • Total Events: ${result.findings.length}`);
    
    if (result.categories.length > 0) {
      console.log(`\n📋 Category Breakdown:`);
      result.categories.forEach((category, index) => {
        console.log(`   ${index + 1}. ${category.category_name} - ${category.findings.length} events`);
      });
    }
    
    // Show sample findings
    if (result.findings.length > 0) {
      console.log(`\n📄 Sample Findings:`);
      result.findings.slice(0, 3).forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding.summary_line}`);
        console.log(`      Severity: ${finding.severity} | Site: ${finding.site_name}`);
      });
    }
    
    // Feature flag status
    console.log(`\n🔧 Feature Flags:`);
    Object.entries(result.feature_flags).forEach(([flag, enabled]) => {
      console.log(`   • ${flag}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`);
    });
    
    console.log(`\n🎉 Parser test completed successfully!`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

// Run test
testParserComparison().catch(console.error);
