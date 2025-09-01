const { iataApi } = require('./axiosIata');
const { devCache } = require('./devCache');
const { limiter } = require('./limiter');

/**
 * IATA airport information structure
 */
const IataInfo = {
  iata: '',
  icao: '',
  airport: '',
  city: '',
  region: '',
  country: '',   // ISO-2
  timezone: '',
  latitude: 0,
  longitude: 0
};

/**
 * Fetch airport information from API Ninjas
 */
async function fetchAirport(iata) {
  try {
    const { data } = await iataApi.get('/airports', { params: { iata } });
    const a = data?.[0];
    if (!a) return null;
    
    return {
      iata: a.iata,
      icao: a.icao,
      airport: a.name,
      city: a.city,
      region: a.region,
      country: a.country,
      timezone: a.timezone,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
    };
  } catch (error) {
    console.error(`❌ Failed to fetch IATA ${iata}:`, error.message);
    return null;
  }
}

/**
 * Main IATA lookup function with caching and rate limiting
 */
async function iataLookup(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    console.error(`❌ Bad IATA code: ${raw}`);
    return null;
  }

  try {
    // 1) check in-memory cache
    const cached = await devCache.get(code);
    if (cached) {
      console.log(`✅ IATA ${code} found in cache`);
      return cached;
    }

    // 2) rate-limited remote fetch
    console.log(`🔍 Fetching IATA ${code} from API Ninjas...`);
    const info = await limiter.schedule(() => fetchAirport(code));
    
    if (info) {
      await devCache.set(code, info); // store in memory only
      console.log(`✅ IATA ${code} cached: ${info.city}, ${info.country} (${info.timezone})`);
    } else {
      console.log(`❌ IATA ${code} not found in API`);
    }
    
    return info;
  } catch (error) {
    console.error(`❌ Error in IATA lookup for ${code}:`, error.message);
    return null;
  }
}

module.exports = { iataLookup, IataInfo };
