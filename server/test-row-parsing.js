// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');

async function testRowParsing() {
  console.log('🧪 Testing row parsing patterns...');
  
  try {
    // Sample data line from the PDF
    const sampleLine = 'ARVA2001 - South Bell - Arlington VAas1-arva2001-w210616Trunk-24%34 min.3';
    console.log(`📄 Testing with sample line: "${sampleLine}"`);
    
    // Test the main regex pattern
    const dataPattern = /^([^-]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})([a-z0-9-]+\.(?:local|net|com)?)([a-z0-9-]+)([+-]?\d+%)?(\d+(?:\.\d+)?)\s*min\.(\d+)$/i;
    const match = sampleLine.match(dataPattern);
    
    console.log('\n🔍 Testing main regex pattern:');
    console.log(`   Pattern: ${dataPattern}`);
    console.log(`   Match: ${match ? '✅' : '❌'}`);
    
    if (match) {
      console.log(`   Groups: ${match.length - 1}`);
      match.forEach((group, i) => {
        if (i > 0) console.log(`   Group ${i}: "${group}"`);
      });
    }
    
    // Test alternative pattern
    console.log('\n🔍 Testing alternative pattern:');
    const altPattern = /([A-Z0-9]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})/;
    const altMatch = sampleLine.match(altPattern);
    
    console.log(`   Pattern: ${altPattern}`);
    console.log(`   Match: ${altMatch ? '✅' : '❌'}`);
    
    if (altMatch) {
      console.log(`   Groups: ${altMatch.length - 1}`);
      altMatch.forEach((group, i) => {
        if (i > 0) console.log(`   Group ${i}: "${group}"`);
      });
    }
    
    // Test individual components
    console.log('\n🔍 Testing individual components:');
    
    // Site pattern
    const sitePattern = /^([^-]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})/;
    const siteMatch = sampleLine.match(sitePattern);
    console.log(`   Site pattern: ${siteMatch ? '✅' : '❌'}`);
    
    // Device pattern
    const devicePattern = /([a-z0-9-]+\.(?:local|net|com))/i;
    const deviceMatch = sampleLine.match(devicePattern);
    console.log(`   Device pattern: ${deviceMatch ? '✅' : '❌'}`);
    
    // Interface pattern
    const interfacePattern = /(Trunk|Gi\d+\/\d+\/\d+|Fa\d+\/\d+|xDP)/i;
    const interfaceMatch = sampleLine.match(interfacePattern);
    console.log(`   Interface pattern: ${interfaceMatch ? '✅' : '❌'}`);
    
    // Duration pattern
    const durationPattern = /(\d+(?:\.\d+)?)\s*min\./;
    const durationMatch = sampleLine.match(durationPattern);
    console.log(`   Duration pattern: ${durationMatch ? '✅' : '❌'}`);
    
    // Occurrences pattern
    const occurrencesPattern = /(\d+)$/;
    const occurrencesMatch = sampleLine.match(occurrencesPattern);
    console.log(`   Occurrences pattern: ${occurrencesMatch ? '✅' : '❌'}`);
    
    // Trend pattern
    const trendPattern = /([+-]?\d+%)/;
    const trendMatch = sampleLine.match(trendPattern);
    console.log(`   Trend pattern: ${trendMatch ? '✅' : '❌'}`);
    
    // Create a simpler, more robust pattern
    console.log('\n🔍 Creating simpler pattern:');
    const simplePattern = /^([^-]+)\s*-\s*([^-]+)\s*-\s*([A-Z]{2})(.*?)(\d+(?:\.\d+)?)\s*min\.(\d+)$/i;
    const simpleMatch = sampleLine.match(simplePattern);
    
    console.log(`   Simple pattern: ${simplePattern}`);
    console.log(`   Match: ${simpleMatch ? '✅' : '❌'}`);
    
    if (simpleMatch) {
      console.log(`   Groups: ${simpleMatch.length - 1}`);
      simpleMatch.forEach((group, i) => {
        if (i > 0) console.log(`   Group ${i}: "${group}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run test
testRowParsing().catch(console.error);
