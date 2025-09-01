// Development-only in-memory cache to prevent Nodemon restarts
// This cache never writes to files, only keeps data in memory

class DevCache {
  constructor() {
    this.cache = new Map();
    console.log('🔧 Using development-only in-memory cache (no file writes)');
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value) {
    this.cache.set(key, value);
    // No file writes - data stays in memory only
  }

  // Method to check if key exists
  has(key) {
    return this.cache.has(key);
  }

  // Method to get cache size
  size() {
    return this.cache.size;
  }

  // Method to clear cache
  clear() {
    this.cache.clear();
  }
}

const devCache = new DevCache();

module.exports = { devCache };
