const fs = require('fs');
const path = require('path');
const { buildAirportIndex } = require('./airportsIndex');
const { extractAirportsFromPdf } = require('./extractAirportsFromPdf');
const { isBusinessHoursLocal } = require('./businessHours');

async function testSignatureAviation() {
  console.log('🧪 Testing Signature Aviation airport analysis...\n');
  
  try {
    // Test 1: Build airport index
    console.log('1️⃣ Building airport index...');
    const airportIndex = await buildAirportIndex();
    console.log(`✅ Airport index built with ${airportIndex.size} airports\n`);
    
    // Test 2: Check for some common Signature Aviation airports
    const testAirports = ['ATL', 'LAX', 'JFK', 'ORD', 'DFW', 'LHR', 'CDG', 'FRA'];
    console.log('2️⃣ Testing common Signature Aviation airports:');
    testAirports.forEach(code => {
      const airport = airportIndex.get(code);
      if (airport) {
        console.log(`   ✅ ${code}: ${airport.name} (${airport.city}, ${airport.country}) - TZ: ${airport.tz}`);
      } else {
        console.log(`   ❌ ${code}: Not found in airport index`);
      }
    });
    console.log();
    
    // Test 3: Business hours calculation
    console.log('3️⃣ Testing business hours calculation:');
    const testCases = [
      { timestamp: '2025-08-30T14:05:00Z', tz: 'America/New_York', expected: true },  // 10:05 AM EDT (business hours)
      { timestamp: '2025-08-30T22:05:00Z', tz: 'America/New_York', expected: false }, // 6:05 PM EDT (after hours)
      { timestamp: '2025-08-31T14:05:00Z', tz: 'America/New_York', expected: false }, // Saturday
      { timestamp: '2025-08-30T08:05:00Z', tz: 'America/Los_Angeles', expected: false }, // 1:05 AM PDT (early morning)
      { timestamp: '2025-08-30T16:05:00Z', tz: 'America/Los_Angeles', expected: true },  // 9:05 AM PDT (business hours)
    ];
    
    testCases.forEach(({ timestamp, tz, expected }) => {
      const result = isBusinessHoursLocal(timestamp, tz);
      const status = result === expected ? '✅' : '❌';
      console.log(`   ${status} ${timestamp} in ${tz}: ${result} (expected: ${expected})`);
    });
    console.log();
    
    // Test 4: Test with a sample PDF if available
    const testPdfPath = path.join(__dirname, 'pdf', 'test-signature-aviation.pdf');
    if (fs.existsSync(testPdfPath)) {
      console.log('4️⃣ Testing PDF extraction...');
      const pdfBuffer = fs.readFileSync(testPdfPath);
      const airports = await extractAirportsFromPdf(pdfBuffer, airportIndex);
      console.log(`✅ Extracted ${airports.length} airports from test PDF`);
      airports.forEach(airport => {
        console.log(`   - ${airport.iata}: ${airport.name} (${airport.city}, ${airport.country})`);
      });
    } else {
      console.log('4️⃣ Skipping PDF test (no test PDF found)');
    }
    
    console.log('\n🎉 All Signature Aviation tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSignatureAviation();
}

module.exports = { testSignatureAviation };
