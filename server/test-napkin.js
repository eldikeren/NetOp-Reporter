const axios = require('axios');

async function testNapkinAPI() {
  console.log('🧪 Testing Napkin API...\n');

  try {
    const response = await axios.post('http://localhost:3001/api/generate-image', {
      prompt: 'Create a simple test chart',
      style: 'professional',
      chartType: 'bar'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Napkin API test successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', response.data);

  } catch (error) {
    console.error('❌ Napkin API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testNapkinAPI();
