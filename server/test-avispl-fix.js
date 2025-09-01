// Test to verify AVI-SPL timezone conversion fixes
require('dotenv').config();
const { DateTime } = require('luxon');

// Test the robust time conversion function
function convertToLocalTimeAviSpl(utcTimestamp, timezone) {
  if (!utcTimestamp || !timezone) return null;
  
  try {
    // Handle different timestamp formats
    let localTime;
    
    // Check if it's already in ISO format (contains T or Z)
    if (utcTimestamp.includes('T') || utcTimestamp.includes('Z')) {
      localTime = DateTime.fromISO(utcTimestamp, { zone: 'utc' }).setZone(timezone);
    } else if (utcTimestamp.includes(' ')) {
      // Handle MM/DD/YYYY HH:mm format
      const [datePart, timePart] = utcTimestamp.split(' ');
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        const isoString = `${year}-${month}-${day}T${timePart}:00.000Z`;
        localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
      } else {
        console.error(`Unsupported timestamp format: ${utcTimestamp}`);
        return null;
      }
    } else {
      // Handle MM/DD/YYYY format - convert to ISO first
      const parts = utcTimestamp.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        const isoString = `${year}-${month}-${day}T00:00:00.000Z`;
        localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
      } else {
        console.error(`Unsupported timestamp format: ${utcTimestamp}`);
        return null;
      }
    }
    
    if (!localTime.isValid) {
      console.error(`Invalid DateTime: ${localTime.invalidReason}`);
      return null;
    }
    
    return {
      localTime: localTime.toFormat('MM/dd/yyyy HH:mm'),
      timezone: timezone,
      isBusinessHours: isBusinessHoursAviSpl(localTime)
    };
  } catch (error) {
    console.error(`Error converting time for ${timezone}:`, error);
    return null;
  }
}

// Check if time is during business hours (09:00-18:00, Mon-Fri)
function isBusinessHoursAviSpl(localTime, businessWindow = { start: 9, end: 18 }) {
  if (!localTime) return false;
  
  const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
  const hour = localTime.hour + localTime.minute / 60;
  return isWeekday && hour >= businessWindow.start && hour < businessWindow.end;
}

function testAviSplTimeConversion() {
  console.log('🧪 Testing AVI-SPL timezone conversion fixes...');
  
  // Test cases from the error log
  const testCases = [
    { timestamp: '08/30/2025', timezone: 'America/Chicago', city: 'Chicago' },
    { timestamp: '08/30/2025 02:46', timezone: 'America/Edmonton', city: 'Edmonton' },
    { timestamp: '08/28/2025 23:10', timezone: 'America/Edmonton', city: 'Calgary' },
    { timestamp: '08/30/2025 10:31', timezone: 'America/Los_Angeles', city: 'Los Angeles' }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n📅 Test ${index + 1}: ${testCase.city}`);
    console.log(`   Timestamp: ${testCase.timestamp}`);
    console.log(`   Timezone: ${testCase.timezone}`);
    
    const result = convertToLocalTimeAviSpl(testCase.timestamp, testCase.timezone);
    
    if (result) {
      console.log(`   ✅ Converted to: ${result.localTime} ${result.timezone}`);
      console.log(`   🏢 Business hours: ${result.isBusinessHours ? 'YES' : 'NO'}`);
    } else {
      console.log(`   ❌ Conversion failed`);
    }
  });
  
  console.log('\n✅ AVI-SPL timezone conversion test completed!');
}

// Run test
testAviSplTimeConversion();
