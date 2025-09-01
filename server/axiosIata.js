const axios = require('axios');

const iataApi = axios.create({
  baseURL: process.env.API_NINJAS_BASE || 'https://api.api-ninjas.com/v1',
  headers: { 'X-Api-Key': process.env.API_NINJAS_KEY || '' },
  timeout: 10_000,
});

// Simple retry logic without axios-retry for now
iataApi.interceptors.response.use(
  response => response,
  async error => {
    const { config } = error;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    if (config.retry >= 3) {
      return Promise.reject(error);
    }
    
    config.retry += 1;
    
    // Retry on 429 or 5xx errors
    const status = error.response?.status;
    if (status === 429 || (status >= 500 && status < 600)) {
      await new Promise(resolve => setTimeout(resolve, 1000 * config.retry));
      return iataApi(config);
    }
    
    return Promise.reject(error);
  }
);

module.exports = { iataApi };
