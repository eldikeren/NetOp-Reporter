const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testFreedomLeisure() {
  console.log('🧪 Testing Freedom Leisure PDF with Structured Parsing...\n');

  try {
    // Create form data with Freedom Leisure PDF
    const form = new FormData();
    form.append('files', fs.createReadStream('pdf/Freedom Leisure_short_executive_report (9).pdf'), {
      filename: 'Freedom Leisure_short_executive_report (9).pdf',
      contentType: 'application/pdf'
    });
    form.append('timezone', 'Europe/London');

    console.log('📤 Sending Freedom Leisure PDF for structured analysis...');
    
    const response = await axios.post('http://localhost:3001/api/analyze', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 120000 // 2 minutes timeout
    });

    console.log('✅ Analysis completed successfully!');
    console.log('📊 Response status:', response.status);
    
    const result = response.data;
    
    // Test the structured parsing output
    console.log('\n🔍 Testing Structured Parsing Output:');
    
    // Check if we have the new structured format
    if (result.results && result.results[0] && result.results[0].analysis_result) {
      const analysis = result.results[0].analysis_result;
      
      console.log('✅ Analysis result structure found');
      
      // Check for structured output
      if (analysis.site_unreachable) {
        console.log('✅ Site Unreachable Events (should be first):');
        console.log('   Events found:', analysis.site_unreachable.events?.length || 0);
        if (analysis.site_unreachable.events) {
          analysis.site_unreachable.events.forEach((event, index) => {
            console.log(`   Event ${index + 1}: ${event.site} - ${event.occurrences} occurrences`);
            console.log(`   Business Hours Impact: ${event.business_hours_impact}`);
          });
        }
      }
      
      if (analysis.interface_down) {
        console.log('✅ Interface Down Events:');
        console.log('   Events found:', analysis.interface_down.events?.length || 0);
        if (analysis.interface_down.events) {
          analysis.interface_down.events.forEach((event, index) => {
            console.log(`   Event ${index + 1}: ${event.site} - ${event.device} - ${event.occurrences} occurrences`);
            console.log(`   Business Hours Impact: ${event.business_hours_impact}`);
          });
        }
      }
      
      if (analysis.vpn_tunnel_down) {
        console.log('✅ VPN Tunnel Down Events:');
        console.log('   Events found:', analysis.vpn_tunnel_down.events?.length || 0);
        if (analysis.vpn_tunnel_down.events) {
          analysis.vpn_tunnel_down.events.forEach((event, index) => {
            console.log(`   Event ${index + 1}: ${event.site} - ${event.tunnel_name} - ${event.occurrences} occurrences`);
            console.log(`   Business Hours Impact: ${event.business_hours_impact}`);
          });
        }
      }
      
      if (analysis.business_hours_summary) {
        console.log('✅ Business Hours Summary:');
        console.log(`   Total events with timestamp: ${analysis.business_hours_summary.total_events_with_timestamp}`);
        console.log(`   Events during business hours: ${analysis.business_hours_summary.events_during_business_hours}`);
        console.log(`   Percentage during business hours: ${analysis.business_hours_summary.percent_during_business_hours}%`);
        
        if (analysis.business_hours_summary.category_breakdown) {
          console.log('   Category breakdown:');
          analysis.business_hours_summary.category_breakdown.forEach(cat => {
            console.log(`     ${cat.category}: ${cat.total_events} total, ${cat.business_hours_events} during business hours (${cat.percentage}%)`);
          });
        }
      }
      
      // Check if we still have the old format (this should be minimal)
      if (analysis.categories && analysis.categories.length > 0) {
        console.log('⚠️ Old format categories found (should be minimal):');
        console.log('   Categories:', analysis.categories.length);
      }
      
    } else {
      console.log('❌ No analysis result found');
      console.log('Available data:', JSON.stringify(result, null, 2));
    }

    console.log('\n🎉 Freedom Leisure PDF test completed!');
    console.log('\n📋 Expected Structured Output:');
    console.log('✅ Site Unreachable Events (FIRST) with business hours flags');
    console.log('✅ Interface Down Events (top 3 by occurrences) with business hours flags');
    console.log('✅ VPN Tunnel Events (top 3 by occurrences) with business hours flags');
    console.log('✅ Business hours summary with percentages per category');
    console.log('✅ Structured JSON format instead of old categories format');

  } catch (error) {
    console.error('❌ Freedom Leisure test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server connection refused. Make sure the server is running on port 3001');
    } else if (error.code === 'ENOTFOUND') {
      console.error('❌ Server not found. Make sure the server is running on localhost:3001');
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}

testFreedomLeisure();
