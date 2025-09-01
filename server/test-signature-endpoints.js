const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function testSignatureEndpoints() {
  console.log('🧪 Testing Signature Aviation endpoints...\n');
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Health check: ${healthResponse.data.status}\n`);
    
    // Test 2: Business hours analysis only
    console.log('2️⃣ Testing business hours analysis...');
    const testEvents = [
      {
        iata: 'ATL',
        timestamp: '2025-08-30T14:05:00Z',
        summary_line: 'Network connectivity issue',
        severity: 'major_issue',
        total_occurrences: 5,
        avg_duration_minutes: 30
      },
      {
        iata: 'LAX',
        timestamp: '2025-08-30T22:05:00Z', // After hours
        summary_line: 'Wi-Fi authentication failure',
        severity: 'critical_issue',
        total_occurrences: 12,
        avg_duration_minutes: 45
      },
      {
        iata: 'JFK',
        timestamp: '2025-08-31T14:05:00Z', // Weekend
        summary_line: 'Service performance degradation',
        severity: 'minor_issue',
        total_occurrences: 3,
        avg_duration_minutes: 15
      }
    ];
    
    const bhResponse = await axios.post(`${BASE_URL}/api/signature/business-hours`, {
      events: testEvents
    });
    
    console.log(`✅ Business hours analysis completed:`);
    console.log(`   - Total events: ${bhResponse.data.business_hours_analysis.total_events}`);
    console.log(`   - Business hours events: ${bhResponse.data.business_hours_analysis.business_hours_events}`);
    console.log(`   - Percentage: ${bhResponse.data.business_hours_analysis.business_hours_percentage}%`);
    
    bhResponse.data.events.forEach(event => {
      console.log(`   - ${event.iata}: ${event.business_hours_impact} (${event.local_time || 'N/A'})`);
    });
    console.log();
    
    // Test 3: Test with a sample PDF if available
    const testPdfPath = path.join(__dirname, 'pdf', 'Freedom Leisure_short_executive_report (9).pdf');
    if (fs.existsSync(testPdfPath)) {
      console.log('3️⃣ Testing PDF airport extraction...');
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('pdf', fs.createReadStream(testPdfPath));
      
             const pdfResponse = await axios.post(`${BASE_URL}/api/signature/airports`, form, {
         headers: form.getHeaders()
       });
      
      console.log(`✅ PDF analysis completed:`);
      console.log(`   - Airports found: ${pdfResponse.data.airports_count}`);
      console.log(`   - Customer: ${pdfResponse.data.customer}`);
      
      if (pdfResponse.data.airports && pdfResponse.data.airports.length > 0) {
        console.log('   - Sample airports:');
        pdfResponse.data.airports.slice(0, 3).forEach(airport => {
          console.log(`     * ${airport.iata}: ${airport.name} (${airport.city}, ${airport.country})`);
        });
      }
      console.log();
    } else {
      console.log('3️⃣ Skipping PDF test (no test PDF found)\n');
    }
    
         // Test 4: Combined airports + events
     console.log('4️⃣ Testing combined airports + events...');
     
     const combinedForm = new FormData();
     if (fs.existsSync(testPdfPath)) {
       combinedForm.append('pdf', fs.createReadStream(testPdfPath));
     }
     combinedForm.append('events', JSON.stringify(testEvents));
     
     const combinedResponse = await axios.post(`${BASE_URL}/api/signature/airports-with-events`, combinedForm, {
       headers: combinedForm.getHeaders()
     });
    
    console.log(`✅ Combined analysis completed:`);
    console.log(`   - Airports: ${combinedResponse.data.airports_count}`);
    console.log(`   - Events: ${combinedResponse.data.events.length}`);
    console.log(`   - Business hours impact: ${combinedResponse.data.business_hours_analysis.business_hours_percentage}%`);
    console.log();
    
    console.log('🎉 All Signature Aviation endpoint tests completed successfully!');
    console.log('\n📋 Available endpoints:');
    console.log('   - POST /api/signature/airports (PDF upload)');
    console.log('   - POST /api/signature/airports-with-events (PDF + events)');
    console.log('   - POST /api/signature/business-hours (events only)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSignatureEndpoints();
}

module.exports = { testSignatureEndpoints };
