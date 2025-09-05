// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { detectTablesPerPage } = require('./lib/pipeline/run');

async function testTableContent() {
  console.log('🧪 Testing table content analysis...');
  
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
    
    // Extract text from PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text || '';
    
    console.log(`📊 Extracted ${pdfText.length} characters from PDF`);
    
    // Split into pages for testing
    const avgPageSize = Math.ceil(pdfText.length / (pdfData.numpages || 1));
    const pages = [];
    for (let i = 0; i < pdfText.length; i += avgPageSize) {
      pages.push(pdfText.substring(i, i + avgPageSize));
    }
    
    console.log(`📄 Split into ${pages.length} simulated pages`);
    
    // Test table detection
    const detected = detectTablesPerPage(pages.slice(0, 10), 0);
    console.log(`📊 Detected ${detected.length} table blocks`);
    
    // Analyze each detected table
    detected.forEach((table, index) => {
      console.log(`\n📋 Table ${index + 1}: ${table.key} on page ${table.page}`);
      console.log(`   Block length: ${table.block.length} characters`);
      console.log(`   Full block content:`);
      console.log(`   ${'='.repeat(80)}`);
      console.log(table.block);
      console.log(`   ${'='.repeat(80)}`);
      
      // Look for data patterns in the block
      const lines = table.block.split('\n');
      console.log(`   📄 Lines in block: ${lines.length}`);
      
      // Look for lines that might contain data
      const dataLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 20 && 
               !trimmed.includes('Site') && 
               !trimmed.includes('Device') && 
               !trimmed.includes('Interface') &&
               !trimmed.includes('The table') &&
               !trimmed.includes('Interface down events');
      });
      
      console.log(`   📊 Potential data lines: ${dataLines.length}`);
      dataLines.forEach((line, i) => {
        console.log(`      ${i + 1}: ${line.substring(0, 100)}...`);
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testTableContent().catch(console.error);
