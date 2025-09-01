// Test timezone conversion for STP example
require('dotenv').config();
const { DateTime } = require('luxon');

// Test the specific STP case: 18:32 UTC should be 13:32 local time (CDT)
const utcTime = '2025-08-30T18:32:00Z';
const timezone = 'America/Chicago';

console.log('🧪 Testing timezone conversion for STP...');
console.log(`UTC time: ${utcTime}`);
console.log(`Timezone: ${timezone}`);

try {
  const localTime = DateTime.fromISO(utcTime, { zone: 'utc' }).setZone(timezone);
  console.log(`Local time: ${localTime.toFormat('MM/dd/yyyy HH:mm')}`);
  console.log(`Local timezone: ${localTime.zoneName}`);
  
  // Check if it's business hours (should be NO for 13:32 on a Saturday)
  const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
  const hour = localTime.hour + localTime.minute / 60;
  const isBusinessHours = isWeekday && hour >= 9 && hour < 18;
  
  console.log(`Weekday: ${isWeekday} (weekday ${localTime.weekday})`);
  console.log(`Hour: ${hour}`);
  console.log(`Business hours: ${isBusinessHours}`);
  
  // Test other times
  const testTimes = [
    '2025-08-30T14:15:00Z', // ATL - should be 10:15 EDT
    '2025-08-30T16:45:00Z', // LHR - should be 17:45 BST
    '2025-08-30T12:30:00Z'  // JFK - should be 08:30 EDT
  ];
  
  const testTimezones = [
    'America/New_York',
    'Europe/London', 
    'America/New_York'
  ];
  
  console.log('\nTesting other conversions:');
  for (let i = 0; i < testTimes.length; i++) {
    const testLocal = DateTime.fromISO(testTimes[i], { zone: 'utc' }).setZone(testTimezones[i]);
    console.log(`${testTimes[i]} UTC → ${testLocal.toFormat('MM/dd/yyyy HH:mm')} ${testTimezones[i]}`);
  }
  
} catch (error) {
  console.error('Error:', error);
}
