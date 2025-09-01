const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testEnhancedAnalysis() {
  console.log('🧪 Testing Enhanced PDF Analysis with Napkin Images...');
  
  const form = new FormData();
  const pdfPath = path.join(__dirname, 'pdf', 'Freedom Leisure_short_executive_report (9).pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found, using test data');
    return;
  }
  
  form.append('files', fs.createReadStream(pdfPath));
  form.append('timezone', 'UTC');
  
  try {
    console.log('📤 Sending PDF for enhanced analysis...');
    
    const response = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Enhanced analysis completed successfully!');
      console.log(`📊 Processed ${result.processed_files} files`);
      
      for (const fileResult of result.results) {
        console.log(`\n📄 File: ${fileResult.original_file_name}`);
        
        if (fileResult.error) {
          console.log(`❌ Error: ${fileResult.error}`);
        } else {
          const analysis = fileResult.analysis_result;
          console.log(`📋 Categories found: ${analysis.categories?.length || 0}`);
          
          if (analysis.categories) {
            for (const category of analysis.categories) {
              console.log(`\n🔍 Category: ${category.category_name}`);
              console.log(`📊 Findings: ${category.findings?.length || 0}`);
              
              if (category.napkin_image) {
                console.log(`🎨 Napkin image: ✅ Generated (${category.napkin_image.length} chars)`);
              } else {
                console.log(`🎨 Napkin image: ❌ Not generated`);
              }
              
              if (category.findings && category.findings.length > 0) {
                console.log('📋 Top findings:');
                category.findings.slice(0, 3).forEach((finding, index) => {
                  console.log(`  ${index + 1}. ${finding.summary_line}`);
                });
              }
            }
          }
        }
      }
    } else {
      console.log('❌ Analysis failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEnhancedAnalysis();
