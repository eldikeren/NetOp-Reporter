const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadDebug() {
  console.log('🧪 Testing Upload Debug...');
  
  const form = new FormData();
  const pdfPath = path.join(__dirname, 'pdf', 'Freedom Leisure_short_executive_report (9).pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found');
    return;
  }
  
  console.log('✅ PDF file exists:', pdfPath);
  console.log('📊 File size:', fs.statSync(pdfPath).size, 'bytes');
  
  form.append('files', fs.createReadStream(pdfPath));
  form.append('timezone', 'UTC');
  
  console.log('📋 Form data prepared');
  console.log('🔗 Target URL: http://localhost:3001/api/analyze');
  
  try {
    console.log('📤 Sending request...');
    
    const response = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      body: form
    });
    
    console.log('📥 Response received');
    console.log('📊 Status:', response.status, response.statusText);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response body:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Success response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.cause) {
      console.error('🔍 Error cause:', error.cause);
    }
  }
}

testUploadDebug();
