// Comprehensive test for Signature Aviation system with IATA timezone conversion
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Mock PDF content for Signature Aviation
const mockSignaturePdfContent = `
SFS-STP sfs-stp-sw10.bbaav experienced device availability (76 occurrences)
critical issue Trend: ↗️ worsening trend
Occurrences: 76 • Last Occurrence: 08/30/2025 18:32

SFS-ATL sfs-atl-sw1.bbaav experienced interface down (3 occurrences)
major issue Trend: ↘️ improving trend
Occurrences: 3 • Last Occurrence: 08/30/2025 14:15

SFS-LHR sfs-lhr-sw5.bbaav experienced vpn tunnel down (2 occurrences)
critical issue Trend: ↗️ worsening trend
Occurrences: 2 • Last Occurrence: 08/30/2025 16:45

SFS-JFK sfs-jfk-sw2.bbaav experienced wan utilization (1 occurrences)
major issue Trend: → stable trend
Occurrences: 1 • Last Occurrence: 08/30/2025 12:30
`;

async function testSignatureAviationComplete() {
  console.log('🧪 Testing complete Signature Aviation system...');
  
  try {
    // Test IATA API first
    console.log('\n1️⃣ Testing IATA API integration...');
    const { iataLookup } = require('./iataClient');
    
    const testIatas = ['STP', 'ATL', 'LHR', 'JFK'];
    for (const iata of testIatas) {
      const result = await iataLookup(iata);
      if (result) {
        console.log(`✅ ${iata}: ${result.city}, ${result.country} (${result.timezone})`);
      }
    }
    
    // Test Signature Aviation processing
    console.log('\n2️⃣ Testing Signature Aviation event processing...');
    const { processSignatureAviationEvents } = require('./signatureAviationHandler');
    
    const mockEvents = [
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
      {
        site_name: 'SFS-LHR',
        summary_line: 'SFS-LHR sfs-lhr-sw5.bbaav experienced vpn tunnel down (2 occurrences)',
        last_occurrence: '2025-08-30T16:45:00Z',
        severity: 'critical',
        avg_duration_minutes: 30
      }
    ];
    
    const processedEvents = await processSignatureAviationEvents(mockEvents);
    console.log(`✅ Processed ${processedEvents.length} events with timezone conversion`);
    
    for (const event of processedEvents) {
      console.log(`   ${event.site_name}: ${event.last_occurrence} (${event.local_timezone}) - Business Hours: ${event.business_hours_impact}`);
    }
    
    // Test business analysis generation
    console.log('\n3️⃣ Testing business analysis generation...');
    const { generateSignatureAviationBusinessAnalysis } = require('./signatureAviationHandler');
    
    const businessAnalysis = generateSignatureAviationBusinessAnalysis(processedEvents);
    console.log(`✅ Business analysis generated:`);
    console.log(`   - Total events: ${businessAnalysis.total_events}`);
    console.log(`   - Business impact events: ${businessAnalysis.business_impact_events}`);
    console.log(`   - Airports analyzed: ${businessAnalysis.airports_analyzed}`);
    
    // Test KPI dashboard
    console.log('\n4️⃣ Testing KPI dashboard generation...');
    const { generateSignatureAviationReport } = require('./signatureKPI');
    
    const mockAirports = [
      { iata: 'STP', city: 'St Paul', name: 'St Paul Downtown Holman Field', country: 'US', continent: 'NA', tz: 'America/Chicago' },
      { iata: 'ATL', city: 'Atlanta', name: 'Hartsfield Jackson Atlanta International Airport', country: 'US', continent: 'NA', tz: 'America/New_York' },
      { iata: 'LHR', city: 'London', name: 'London Heathrow Airport', country: 'GB', continent: 'EU', tz: 'Europe/London' }
    ];
    
    const signatureReport = generateSignatureAviationReport(processedEvents, mockAirports);
    console.log(`✅ KPI dashboard generated:`);
    console.log(`   - Dashboard table: ${signatureReport.dashboard_table.length} KPIs`);
    console.log(`   - Narrative: ${signatureReport.narrative.substring(0, 100)}...`);
    console.log(`   - Charts: ${signatureReport.charts.length} chart specs`);
    
    console.log('\n✅ Complete Signature Aviation system test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testSignatureAviationComplete().catch(console.error);
