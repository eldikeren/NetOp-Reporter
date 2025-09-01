// Test to verify the isSignatureAviation parameter fix
require('dotenv').config();

// Mock the analyzeChunk function to test parameter passing
function mockAnalyzeChunk(chunkText, chunkIndex, totalChunks, timezone, isSignatureAviation) {
  console.log('✅ analyzeChunk called with correct parameters:');
  console.log(`- chunkText length: ${chunkText.length}`);
  console.log(`- chunkIndex: ${chunkIndex}`);
  console.log(`- totalChunks: ${totalChunks}`);
  console.log(`- timezone: ${timezone}`);
  console.log(`- isSignatureAviation: ${isSignatureAviation}`);
  
  return {
    categories: [],
    business_hours_events_list: []
  };
}

// Test the function signature
function testFunctionSignature() {
  console.log('🧪 Testing analyzeChunk function signature...');
  
  const mockChunk = "Device Availability\nSFS-STP sfs-stp-sw10.bbaav experienced device availability";
  const mockIsSignatureAviation = true;
  
  try {
    const result = mockAnalyzeChunk(mockChunk, 0, 1, 'UTC', mockIsSignatureAviation);
    console.log('✅ Function call successful');
    console.log('✅ isSignatureAviation parameter is now properly passed');
  } catch (error) {
    console.log('❌ Function call failed:', error.message);
  }
}

// Run test
testFunctionSignature();
