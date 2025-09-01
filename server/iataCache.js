// Simple in-memory cache for now to avoid Keyv issues
const fs = require('fs').promises;
const path = require('path');

const cacheFile = process.env.IATA_CACHE_FILE || './cache/iata.json';
const ttlMs = (Number(process.env.IATA_CACHE_TTL_SECONDS) || 86400) * 1000;

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.loadCache();
  }

  async loadCache() {
    try {
      const data = await fs.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(data);
      const now = Date.now();
      
      for (const [key, value] of Object.entries(cacheData)) {
        if (value.expires > now) {
          this.cache.set(key, value.data);
        }
      }
      console.log(`✅ Loaded ${this.cache.size} cached IATA entries`);
    } catch (error) {
      console.log('No existing cache file found, starting fresh');
    }
  }

  async saveCache() {
    try {
      const cacheData = {};
      const now = Date.now();
      
      for (const [key, value] of this.cache.entries()) {
        cacheData[key] = {
          data: value,
          expires: now + ttlMs
        };
      }
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value) {
    this.cache.set(key, value);
    // Debounce cache saves to avoid frequent file writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveCache().catch(err => console.error('Cache save error:', err));
    }, 1000); // Save after 1 second of inactivity
  }
}

const iataCache = new SimpleCache();

// Ensure cache is saved on process exit
process.on('beforeExit', async () => {
  if (iataCache.saveTimeout) {
    clearTimeout(iataCache.saveTimeout);
  }
  await iataCache.saveCache();
});

module.exports = { iataCache };
