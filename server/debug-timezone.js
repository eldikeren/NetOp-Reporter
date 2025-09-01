// Debug timezone conversion issues
require('dotenv').config();
const { DateTime } = require('luxon');

function debugTimezoneConversion() {
  console.log('🔍 Debugging timezone conversion...');
  
  const testTimestamp = '08/30/2025 02:46';
  const timezone = 'America/Edmonton';
  
  console.log(`\n📅 Testing: "${testTimestamp}" → ${timezone}`);
  
  // Check if it contains space
  console.log(`Contains space: ${testTimestamp.includes(' ')}`);
  
  if (testTimestamp.includes(' ')) {
    const [datePart, timePart] = testTimestamp.split(' ');
    console.log(`Date part: "${datePart}"`);
    console.log(`Time part: "${timePart}"`);
    
    const parts = datePart.split('/');
    console.log(`Date parts: [${parts.join(', ')}]`);
    
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      const isoString = `${year}-${month}-${day}T${timePart}:00.000Z`;
      
      console.log(`Generated ISO: "${isoString}"`);
      
      try {
        const localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
        console.log(`✅ Luxon result: ${localTime.toFormat('MM/dd/yyyy HH:mm')} ${timezone}`);
        console.log(`Valid: ${localTime.isValid}`);
        console.log(`Invalid reason: ${localTime.invalidReason}`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n✅ Debug completed!');
}

// Run debug
debugTimezoneConversion();
