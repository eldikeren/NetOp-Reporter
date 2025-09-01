// Test enhanced city matcher for AVI-SPL edge cases
require('dotenv').config();
const { extractCityFromSiteName } = require('./cityMatcher');

function testCityMatcher() {
  console.log('🧪 Testing enhanced city matcher...');
  
  const testCases = [
    // Standard cases
    { site: 'Chicago', expected: 'chicago' },
    { site: 'Edmonton', expected: 'edmonton' },
    { site: 'Frankfurt', expected: 'frankfurt' },
    
    // Edge cases that were failing
    { site: 'Washington DC', expected: 'washington' },
    { site: 'Denver', expected: 'denver' },
    { site: 'Ft Lauderdale', expected: 'fort lauderdale' },
    { site: 'Boston VL', expected: 'boston' },
    { site: 'Chicago Warehouse', expected: 'chicago' },
    { site: 'Phoenix QCC', expected: 'phoenix' },
    
    // Sites that should be ignored
    { site: 'Flexential', expected: null },
    { site: 'Multiple Sites', expected: null },
    { site: 'Global', expected: null },
    { site: 'HQ', expected: null }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: "${testCase.site}"`);
    
    const result = extractCityFromSiteName(testCase.site);
    
    if (result) {
      console.log(`   ✅ Found: ${result.city} (${result.timezone})`);
      if (result.city === testCase.expected) {
        console.log(`   ✅ Expected match: ${testCase.expected}`);
      } else {
        console.log(`   ⚠️ Expected: ${testCase.expected}, Got: ${result.city}`);
      }
    } else {
      console.log(`   ❌ No match found`);
      if (testCase.expected === null) {
        console.log(`   ✅ Correctly ignored`);
      } else {
        console.log(`   ❌ Expected: ${testCase.expected}`);
      }
    }
  });
  
  console.log('\n✅ City matcher test completed!');
}

// Run test
testCityMatcher();
