// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { detectTablesPerPage } = require('./lib/pipeline/run');
const { TABLES } = require('./lib/parse/detect');

async function testTableDetection() {
  console.log('🧪 Testing table detection...');
  
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
    console.log(`📄 PDF has ${pdfData.numpages || 'unknown'} pages`);
    
    // Split into pages for testing
    const avgPageSize = Math.ceil(pdfText.length / (pdfData.numpages || 1));
    const pages = [];
    for (let i = 0; i < pdfText.length; i += avgPageSize) {
      pages.push(pdfText.substring(i, i + avgPageSize));
    }
    
    console.log(`📄 Split into ${pages.length} simulated pages`);
    
    // Test table detection on first few pages
    const testPages = pages.slice(0, 3);
    console.log('\n🔍 Testing table detection on first 3 pages...');
    
    for (let i = 0; i < testPages.length; i++) {
      const page = testPages[i];
      console.log(`\n📄 Page ${i + 1}:`);
      console.log(`   Length: ${page.length} characters`);
      
      // Look for common table patterns
      const patterns = [
        'Interface down events',
        'Device Availability', 
        'VPN Tunnel Down anomalies',
        'Site Unreachable events',
        'Wi-Fi Issues',
        'Port Errors',
        'WAN Utilization',
        'Connected clients'
      ];
      
      patterns.forEach(pattern => {
        if (page.includes(pattern)) {
          console.log(`   ✅ Found pattern: "${pattern}"`);
          
          // Test the specific regex for this pattern
          const tableDef = TABLES.find(t => t.key === pattern);
          if (tableDef) {
            console.log(`   🔍 Testing regex: ${tableDef.titleRe}`);
            const titleMatch = page.match(tableDef.titleRe);
            if (titleMatch) {
              console.log(`   ✅ Title regex matched at index: ${titleMatch.index}`);
              
              // Test columns regex
              console.log(`   🔍 Testing columns regex: ${tableDef.columnsRe}`);
              const slice = page.slice(titleMatch.index, titleMatch.index + 6000);
              const columnsMatch = slice.match(tableDef.columnsRe);
              if (columnsMatch) {
                console.log(`   ✅ Columns regex matched!`);
                console.log(`   📊 Columns found: ${columnsMatch[0]}`);
              } else {
                console.log(`   ❌ Columns regex failed`);
                console.log(`   📄 Slice preview: ${slice.substring(0, 300)}...`);
              }
            } else {
              console.log(`   ❌ Title regex failed`);
            }
          }
        }
      });
      
      // Look for pipe-delimited tables
      const pipeMatches = page.match(/\|[^|]+\|[^|]+\|[^|]+\|/g);
      if (pipeMatches) {
        console.log(`   📊 Found ${pipeMatches.length} pipe-delimited table rows`);
        console.log(`   Sample: ${pipeMatches[0]?.substring(0, 100)}...`);
      }
    }
    
    // Test the actual table detection function
    console.log('\n🔧 Testing detectTablesPerPage function...');
    const detected = detectTablesPerPage(pages.slice(0, 5), 0);
    console.log(`📊 Detected ${detected.length} table blocks`);
    
    detected.forEach((table, index) => {
      console.log(`\n📋 Table ${index + 1}:`);
      console.log(`   Key: ${table.key}`);
      console.log(`   Page: ${table.page}`);
      console.log(`   Block length: ${table.block.length} characters`);
      console.log(`   Block preview: ${table.block.substring(0, 200)}...`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testTableDetection().catch(console.error);
