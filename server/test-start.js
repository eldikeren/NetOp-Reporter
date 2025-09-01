console.log('Testing server startup...');

try {
  const app = require('./index.js');
  console.log('✅ Server loaded successfully');
  console.log('App type:', typeof app);
  
  // Try to start the server
  const PORT = 3001;
  const server = app.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
    console.log('✅ Health check: http://localhost:3001/health');
    
    // Test the health endpoint
    setTimeout(() => {
      const http = require('http');
      const req = http.get('http://localhost:3001/health', (res) => {
        console.log(`✅ Health check response: ${res.statusCode}`);
        server.close(() => {
          console.log('✅ Server test completed successfully');
          process.exit(0);
        });
      });
      
      req.on('error', (err) => {
        console.error('❌ Health check failed:', err.message);
        server.close(() => {
          process.exit(1);
        });
      });
    }, 1000);
  });
  
  server.on('error', (err) => {
    console.error('❌ Server startup failed:', err.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Failed to load server:', error.message);
  process.exit(1);
}
