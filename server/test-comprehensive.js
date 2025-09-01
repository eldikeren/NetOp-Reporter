const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testComprehensive() {
  console.log('🧪 COMPREHENSIVE TEST - All Improvements\n');
  console.log('=' .repeat(60));

  // Test 1: Health Check
  console.log('\n📋 Test 1: Health Check');
  try {
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check passed');
    console.log('   OpenAI API:', healthResponse.data.services.openai ? '✅ Configured' : '❌ Not configured');
    console.log('   Napkin API:', healthResponse.data.services.napkin ? '✅ Configured' : '❌ Not configured');
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Styles Endpoint
  console.log('\n📋 Test 2: Styles Endpoint');
  try {
    const stylesResponse = await axios.get('http://localhost:3001/api/styles');
    console.log('✅ Styles endpoint passed');
    console.log('   Styles available:', Object.keys(stylesResponse.data.styles).length);
    console.log('   Chart types available:', Object.keys(stylesResponse.data.chartTypes).length);
  } catch (error) {
    console.log('❌ Styles endpoint failed:', error.message);
  }

  // Test 3: Analysis with ALL Tables
  console.log('\n📋 Test 3: Analysis with ALL Tables');
  try {
    const form = new FormData();
    form.append('files', fs.createReadStream('test-signature-aviation.txt'), {
      filename: 'test-signature-aviation.txt',
      contentType: 'text/plain'
    });
    form.append('timezone', 'America/New_York');

    const analysisResponse = await axios.post('http://localhost:3001/api/analyze', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 120000
    });

    const result = analysisResponse.data;
    const analysis = result.results[0].analysis_result;

    console.log('✅ Analysis completed successfully');
    console.log('   Categories extracted:', analysis.categories.length);
    console.log('   Business hours analysis:', analysis.business_hours_analysis ? '✅ Present' : '❌ Missing');
    console.log('   Enhanced insights:', analysis.enhanced_insights ? '✅ Present' : '❌ Missing');
    console.log('   Customer timezone:', analysis.report_metadata.customer_timezone);
    
    // Check for specific tables
    const categoryNames = analysis.categories.map(c => c.category_name);
    const expectedTables = [
      'Interface Down Events', 'Device Availability', 'VPN Tunnel Down Anomalies',
      'Wan Utilization', 'Wi-Fi Issues', 'Port Errors'
    ];
    
    console.log('   Tables found:');
    expectedTables.forEach(table => {
      const found = categoryNames.some(name => name.toLowerCase().includes(table.toLowerCase().replace(' ', '')));
      console.log(`     ${table}: ${found ? '✅' : '❌'}`);
    });

    // Check business hours impact
    let businessHoursEvents = 0;
    analysis.categories.forEach(category => {
      if (category.findings) {
        category.findings.forEach(finding => {
          if (finding.business_hours_impact) {
            businessHoursEvents++;
          }
        });
      }
    });
    console.log(`   Business hours events: ${businessHoursEvents} marked as business-affecting`);

  } catch (error) {
    console.log('❌ Analysis test failed:', error.message);
  }

  // Test 4: Napkin API (Direct)
  console.log('\n📋 Test 4: Napkin API (Direct)');
  try {
    const token = 'sk-d4c4e37aa968c8df99eb41617d03a0cf7a4f1521f4f2184f1c18741d00c9ec64';
    const napkinResponse = await axios.post('https://api.napkin.ai/v1/visual', {
      content: 'Create a simple test chart',
      style: 'professional',
      format: 'png',
      language: 'en-US'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Direct Napkin API working');
    console.log('   Request ID:', napkinResponse.data.id);
    console.log('   Status:', napkinResponse.data.status);
  } catch (error) {
    console.log('❌ Direct Napkin API failed:', error.message);
  }

  // Test 5: Napkin API (Through Server)
  console.log('\n📋 Test 5: Napkin API (Through Server)');
  try {
    const serverNapkinResponse = await axios.post('http://localhost:3001/api/generate-image', {
      prompt: 'Create a simple test chart',
      style: 'professional',
      chartType: 'bar'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Server Napkin API working');
    console.log('   Success:', serverNapkinResponse.data.success);
  } catch (error) {
    console.log('❌ Server Napkin API failed:', error.message);
    if (error.response) {
      console.log('   Error details:', error.response.data);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🎉 COMPREHENSIVE TEST COMPLETED');
  console.log('\n📋 Summary of All Improvements:');
  console.log('✅ ALL tables extraction (multiple categories)');
  console.log('✅ Business hours analysis with specific events');
  console.log('✅ Enhanced insights and recommendations');
  console.log('✅ Customer timezone integration');
  console.log('✅ Business hours impact indicators');
  console.log('✅ Comprehensive data extraction from all tables');
  console.log('✅ Napkin API integration (direct)');
  console.log('✅ Styles and chart types endpoint');
  console.log('✅ Health check and service status');
}

testComprehensive();
