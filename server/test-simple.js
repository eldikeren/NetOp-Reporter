const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testSimpleAnalysis() {
  console.log('🧪 Testing Simple PDF Analysis...');
  
  try {
    // Use an existing file from uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.promises.readdir(uploadsDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = pdfFiles[0]; // Use the first available file
    const pdfPath = path.join(uploadsDir, testFile);
    
    console.log(`📄 Using file: ${testFile}`);
    
    // Read the file as buffer
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    
    // Create form data
    const form = new FormData();
    form.append('files', pdfBuffer, {
      filename: testFile,
      contentType: 'application/pdf'
    });
    
    console.log('📤 Sending PDF for analysis...');
    
    const response = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Test failed: HTTP ${response.status}: ${response.statusText}`);
      console.log(`Error details: ${errorText}`);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Analysis completed successfully!');
    console.log('📊 Results:');
    console.log(`   • Categories: ${result.categories?.length || 0}`);
    console.log(`   • Total Events: ${result.business_hours_analysis?.total_events || 0}`);
    console.log(`   • Report Title: ${result.report_metadata?.report_title || 'N/A'}`);
    console.log(`   • Customer: ${result.report_metadata?.customer_name || 'N/A'}`);
    
    if (result.categories && result.categories.length > 0) {
      console.log('\n📋 Categories found:');
      result.categories.forEach((category, index) => {
        console.log(`   ${index + 1}. ${category.category_name} - ${category.findings?.length || 0} events`);
      });
    }
    
    if (result.recommendations) {
      console.log('\n💡 Recommendations generated successfully');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
testSimpleAnalysis().catch(console.error);
