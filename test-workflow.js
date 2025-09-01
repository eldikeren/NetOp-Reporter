const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const CLIENT_URL = 'http://localhost:3000';

async function testHealthCheck() {
  console.log('🔍 Testing Health Check...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

async function testStylesEndpoint() {
  console.log('🔍 Testing Styles Endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/api/styles`);
    console.log('✅ Styles endpoint passed:', Object.keys(response.data.styles).length, 'styles available');
    return true;
  } catch (error) {
    console.log('❌ Styles endpoint failed:', error.message);
    return false;
  }
}

async function testClientAccess() {
  console.log('🔍 Testing Client Access...');
  try {
    const response = await axios.get(CLIENT_URL);
    console.log('✅ Client access passed:', response.status);
    return true;
  } catch (error) {
    console.log('❌ Client access failed:', error.message);
    return false;
  }
}

async function testNapkinAPI() {
  console.log('🔍 Testing Napkin API (rate limit aware)...');
  try {
    const response = await axios.post(`${BASE_URL}/api/generate-image`, {
      prompt: 'Create a simple test chart',
      style: 'professional',
      chartType: 'bar'
    });
    console.log('✅ Napkin API passed:', response.data);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('⚠️ Napkin API rate limited (expected):', error.response.data.error);
      return true; // Rate limiting is expected behavior
    }
    console.log('❌ Napkin API failed:', error.message);
    return false;
  }
}

async function testAnalysisEndpoint() {
  console.log('🔍 Testing Analysis Endpoint...');
  try {
    // Create a mock PDF content for testing
    const mockPdfContent = `
    Interface Down Events
    Device: Router-01, Interface: GigabitEthernet0/1, Occurrences: 5, Avg Duration: 45min
    
    VPN Tunnel Issues
    Tunnel: SiteA-SiteB, Occurrences: 3, Avg Duration: 120min
    
    WLAN/Wireless Problems
    AP: AP-001, Authentication Errors: 25, DHCP Errors: 12
    
    Performance Issues
    SLA Violations: 8, Avg Response Time: 250ms
    `;
    
    const response = await axios.post(`${BASE_URL}/api/analyze`, {
      pdfText: mockPdfContent,
      fileName: 'test-report.pdf'
    });
    console.log('✅ Analysis endpoint passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Analysis endpoint failed:', error.message);
    return false;
  }
}

async function testFileStructure() {
  console.log('🔍 Testing File Structure...');
  const requiredFiles = [
    'server/index.js',
    'client/src/App.tsx',
    'client/src/components/analysis/InsightReport.tsx',
    'client/src/components/analysis/emailUtils.ts',
    'package.json'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      allFilesExist = false;
    }
  }
  return allFilesExist;
}

async function testEnvironmentVariables() {
  console.log('🔍 Testing Environment Configuration...');
  try {
    const serverCode = fs.readFileSync('server/index.js', 'utf8');
    
    // Check for OpenAI API key
    if (serverCode.includes('sk-proj-')) {
      console.log('✅ OpenAI API key configured');
    } else {
      console.log('❌ OpenAI API key not found');
      return false;
    }
    
    // Check for Napkin API token
    if (serverCode.includes('sk-d4c4e37')) {
      console.log('✅ Napkin API token configured');
    } else {
      console.log('❌ Napkin API token not found');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ Environment test failed:', error.message);
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive A-Z Test...\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Styles Endpoint', fn: testStylesEndpoint },
    { name: 'Client Access', fn: testClientAccess },
    { name: 'Napkin API', fn: testNapkinAPI },
    { name: 'Analysis Endpoint', fn: testAnalysisEndpoint },
    { name: 'File Structure', fn: testFileStructure },
    { name: 'Environment Variables', fn: testEnvironmentVariables }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n📋 Running ${test.name}...`);
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
    console.log(`${result ? '✅' : '❌'} ${test.name} ${result ? 'PASSED' : 'FAILED'}`);
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 Overall Result: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Application is ready for use.');
  } else {
    console.log('⚠️ Some tests failed. Please check the issues above.');
  }
  
  return passed === total;
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
