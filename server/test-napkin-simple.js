const axios = require('axios');

async function testNapkinSimple() {
  console.log('🧪 Testing Napkin API Simple...\n');

  const token = 'sk-d4c4e37aa968c8df99eb41617d03a0cf7a4f1521f4f2184f1c18741d00c9ec64';
  
  try {
    // Test the API endpoint directly
    const response = await axios.post('https://api.napkin.ai/v1/visual', {
      content: 'Create a simple bar chart',
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

    console.log('✅ Direct Napkin API test successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', response.data);

  } catch (error) {
    console.error('❌ Direct Napkin API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testNapkinSimple();
