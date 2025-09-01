// Test to verify timezone conversion fix
require('dotenv').config();
const { DateTime } = require('luxon');

function testTimezoneConversion() {
  console.log('🧪 Testing timezone conversion fix...');
  
  // Test the problematic timestamp format
  const testTimestamp = '08/30/2025';
  const timezone = 'America/Los_Angeles';
  
  console.log(`\n📅 Testing timestamp: ${testTimestamp}`);
  console.log(`🌍 Timezone: ${timezone}`);
  
  try {
    // Parse the MM/DD/YYYY format
    const parts = testTimestamp.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      const isoString = `${year}-${month}-${day}T00:00:00.000Z`;
      
      console.log(`🔄 Converted to ISO: ${isoString}`);
      
      const localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
      const formattedTime = localTime.toFormat('MM/dd/yyyy HH:mm');
      
      console.log(`✅ Successfully converted to: ${formattedTime} ${timezone}`);
      
      // Check business hours
      const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
      const hour = localTime.hour + localTime.minute / 60;
      const isBusinessHours = isWeekday && hour >= 9 && hour < 18;
      
      console.log(`🏢 Business hours: ${isBusinessHours ? 'YES' : 'NO'}`);
      
    } else {
      console.log('❌ Invalid timestamp format');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n✅ Test completed!');
}

// Run test
testTimezoneConversion();
