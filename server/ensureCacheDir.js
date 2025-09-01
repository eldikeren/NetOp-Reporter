// Utility to ensure cache directory exists
const fs = require('fs');
const path = require('path');

function ensureCacheDirectory() {
  const cacheDir = path.join(__dirname, 'cache');
  
  if (!fs.existsSync(cacheDir)) {
    console.log('📁 Creating cache directory...');
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log('✅ Cache directory created');
  } else {
    console.log('✅ Cache directory already exists');
  }
}

module.exports = { ensureCacheDirectory };
