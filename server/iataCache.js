// In-memory only cache to prevent Nodemon restarts during development
class SimpleCache {
  constructor() {
    this.cache = new Map();
    console.log('✅ Using in-memory IATA cache (no file writes)');
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value) {
    this.cache.set(key, value);
    // No file writes during development to prevent Nodemon restarts
  }
}

const iataCache = new SimpleCache();

module.exports = { iataCache };
