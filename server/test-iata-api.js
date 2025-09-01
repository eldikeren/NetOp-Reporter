// Test script for IATA API integration
require('dotenv').config();
const { iataLookup } = require('./iataClient');

async function testIataApi() {
  console.log('🧪 Testing IATA API integration...');
  
  // Test cases
  const testCodes = ['STP', 'ATL', 'LHR', 'JFK', 'LAX'];
  
  for (const code of testCodes) {
    console.log(`\n🔍 Testing IATA code: ${code}`);
    try {
      const result = await iataLookup(code);
      if (result) {
        console.log(`✅ ${code}: ${result.city}, ${result.country} (${result.timezone})`);
        console.log(`   Airport: ${result.airport}`);
        console.log(`   Coordinates: ${result.latitude}, ${result.longitude}`);
      } else {
        console.log(`❌ ${code}: Not found`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${code}:`, error.message);
    }
  }
  
  console.log('\n✅ IATA API test completed');
}

// Run test
testIataApi().catch(console.error);
