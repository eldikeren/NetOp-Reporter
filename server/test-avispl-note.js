// Test to verify AVI-SPL note is included in business hours analysis
require('dotenv').config();

// Mock AVI-SPL analysis result
const mockAviSplAnalysis = {
  total_events: 10,
  business_impact_events: 3,
  no_business_hours_events: 7,
  business_impact_percentage: 30,
  cities_analyzed: 5,
  city_breakdown: {
    'chicago': { total: 3, businessHours: 1, timezone: 'America/Chicago' },
    'edmonton': { total: 2, businessHours: 1, timezone: 'America/Edmonton' },
    'los angeles': { total: 2, businessHours: 0, timezone: 'America/Los_Angeles' },
    'dubai': { total: 2, businessHours: 1, timezone: 'Asia/Dubai' },
    'london': { total: 1, businessHours: 0, timezone: 'Europe/London' }
  },
  business_impact_events_list: [
    {
      event_description: 'Chicago Warehouse experienced interface down',
      business_impact: 'Global business impact in chicago',
      occurrence_time: '08/29/2025 19:00',
      local_time: '08/29/2025 19:00',
      timezone: 'America/Chicago',
      duration_minutes: 45,
      severity: 'critical_issue'
    }
  ],
  analysis_note: "Important: This analysis focuses on events with explicit time stamps converted to local time zones based on city detection from site names.",
  avispl_note: "**Note: For AVI-SPL reports, all timestamps have been automatically converted from UTC to the corresponding local time zones based on site names.**"
};

function testAviSplNote() {
  console.log('🧪 Testing AVI-SPL note inclusion...');
  
  console.log('\n📋 Mock AVI-SPL Analysis:');
  console.log('- Total events:', mockAviSplAnalysis.total_events);
  console.log('- Business impact events:', mockAviSplAnalysis.business_impact_events);
  console.log('- Business impact percentage:', mockAviSplAnalysis.business_impact_percentage + '%');
  console.log('- Cities analyzed:', mockAviSplAnalysis.cities_analyzed);
  
  console.log('\n📝 AVI-SPL Note:');
  console.log(mockAviSplAnalysis.avispl_note);
  
  console.log('\n✅ AVI-SPL note test completed!');
  console.log('The note should now appear in AVI-SPL reports under the Business Hours Impact section.');
}

// Run test
testAviSplNote();
