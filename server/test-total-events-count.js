// Test to verify total time stamped events count for all customers
require('dotenv').config();

// Mock events for different customers
const mockEvents = [
  // Signature Aviation events
  {
    site_name: 'SFS-STP',
    summary_line: 'SFS-STP sfs-stp-sw10.bbaav experienced device availability (76 occurrences)',
    last_occurrence: '2025-08-30T18:32:00Z',
    severity: 'critical',
    avg_duration_minutes: 50
  },
  {
    site_name: 'SFS-ATL',
    summary_line: 'SFS-ATL sfs-atl-sw1.bbaav experienced interface down (3 occurrences)',
    last_occurrence: '2025-08-30T14:15:00Z',
    severity: 'major',
    avg_duration_minutes: 15
  },
  // Regular customer events
  {
    site_name: 'Office-Main',
    summary_line: 'Office-Main switch1 experienced wifi issues (5 occurrences)',
    last_occurrence: '2025-08-30T10:30:00Z',
    severity: 'major',
    avg_duration_minutes: 20
  },
  {
    site_name: 'Office-Branch',
    summary_line: 'Office-Branch router1 experienced port errors (2 occurrences)',
    last_occurrence: '2025-08-30T16:45:00Z',
    severity: 'critical',
    avg_duration_minutes: 30
  },
  // Events without timestamps (should not be counted)
  {
    site_name: 'Office-Server',
    summary_line: 'Office-Server server1 experienced high cpu usage',
    last_occurrence: '2025-08-30', // No time, just date
    severity: 'major',
    avg_duration_minutes: 60
  },
  {
    site_name: 'Office-Network',
    summary_line: 'Office-Network switch2 experienced packet loss',
    last_occurrence: null, // No timestamp
    severity: 'minor',
    avg_duration_minutes: 15
  }
];

function testTotalEventsCount() {
  console.log('🧪 Testing total time stamped events count for all customers...');
  
  // Count ALL events with timestamps from the entire PDF for ALL customers
  const allTimestampedEvents = mockEvents.filter(event => event.last_occurrence && event.last_occurrence.includes(':'));
  const totalAllEvents = allTimestampedEvents.length;
  
  console.log(`📊 Total events found: ${mockEvents.length}`);
  console.log(`📊 Events with timestamps: ${allTimestampedEvents.length}`);
  console.log(`📊 Events without timestamps: ${mockEvents.length - allTimestampedEvents.length}`);
  console.log(`📊 Using total: ${totalAllEvents}`);
  
  // Show which events have timestamps
  console.log('\n📅 Events WITH timestamps (should be counted):');
  allTimestampedEvents.forEach((event, index) => {
    console.log(`   ${index + 1}. ${event.site_name}: ${event.last_occurrence}`);
  });
  
  // Show which events don't have timestamps
  const eventsWithoutTimestamps = mockEvents.filter(event => !event.last_occurrence || !event.last_occurrence.includes(':'));
  console.log('\n❌ Events WITHOUT timestamps (should NOT be counted):');
  eventsWithoutTimestamps.forEach((event, index) => {
    console.log(`   ${index + 1}. ${event.site_name}: ${event.last_occurrence || 'No timestamp'}`);
  });
  
  // Test business hours calculation
  const businessHoursEvents = allTimestampedEvents.filter(event => {
    // Simulate business hours check (9 AM - 6 PM)
    const time = event.last_occurrence.split('T')[1].split(':')[0];
    const hour = parseInt(time);
    return hour >= 9 && hour < 18;
  });
  
  console.log(`\n🕐 Business hours events: ${businessHoursEvents.length} out of ${totalAllEvents}`);
  console.log(`📊 Business hours percentage: ${totalAllEvents > 0 ? Math.round((businessHoursEvents.length / totalAllEvents) * 100) : 0}%`);
  
  console.log('\n✅ Test completed!');
}

// Run test
testTotalEventsCount();
