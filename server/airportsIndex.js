// Loads and caches OurAirports airports.csv → Map<IATA, meta>
const https = require('https');
const { parse } = require('csv-parse/sync');

const OUR_AIRPORTS_URL = 'https://ourairports.com/data/airports.csv';

// Fallback static dataset for common Signature Aviation airports
const FALLBACK_AIRPORTS = [
  { iata: 'ATL', name: 'Hartsfield–Jackson Atlanta International Airport', city: 'Atlanta', country: 'US', continent: 'NA', tz: 'America/New_York', lat: 33.6367, lon: -84.4281 },
  { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'US', continent: 'NA', tz: 'America/Los_Angeles', lat: 33.9416, lon: -118.4085 },
  { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'US', continent: 'NA', tz: 'America/New_York', lat: 40.6413, lon: -73.7781 },
  { iata: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'US', continent: 'NA', tz: 'America/Chicago', lat: 41.9786, lon: -87.9048 },
  { iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'US', continent: 'NA', tz: 'America/Chicago', lat: 32.8968, lon: -97.0380 },
  { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'GB', continent: 'EU', tz: 'Europe/London', lat: 51.4700, lon: -0.4543 },
  { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'FR', continent: 'EU', tz: 'Europe/Paris', lat: 49.0097, lon: 2.5479 },
  { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'DE', continent: 'EU', tz: 'Europe/Berlin', lat: 50.0379, lon: 8.5622 },
  { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'CA', continent: 'NA', tz: 'America/Toronto', lat: 43.6777, lon: -79.6248 },
  { iata: 'VNY', name: 'Van Nuys Airport', city: 'Los Angeles', country: 'US', continent: 'NA', tz: 'America/Los_Angeles', lat: 34.2098, lon: -118.4900 },
  { iata: 'LTN', name: 'London Luton Airport', city: 'London', country: 'GB', continent: 'EU', tz: 'Europe/London', lat: 51.8747, lon: -0.3683 },
  { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'US', continent: 'NA', tz: 'America/New_York', lat: 25.7932, lon: -80.2906 },
  { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'US', continent: 'NA', tz: 'America/Los_Angeles', lat: 37.6189, lon: -122.3750 },
  { iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'US', continent: 'NA', tz: 'America/New_York', lat: 42.3656, lon: -71.0096 },
  { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'US', continent: 'NA', tz: 'America/Denver', lat: 39.8561, lon: -104.6737 }
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const options = {
      rejectUnauthorized: false, // Allow self-signed certificates
      timeout: 30000 // 30 second timeout
    };
    
    https.get(url, options, res => {
      const bufs = [];
      res.on('data', d => bufs.push(d));
      res.on('end', () => resolve(Buffer.concat(bufs)));
    }).on('error', reject);
  });
}

async function buildAirportIndex() {
  console.log('🛫 Building airport index from OurAirports dataset...');
  
  try {
    const csv = (await fetch(OUR_AIRPORTS_URL)).toString('utf8');
    
    // Check if we got HTML instead of CSV
    if (csv.includes('<!DOCTYPE') || csv.includes('<html')) {
      console.log('⚠️ OurAirports URL returned HTML, using fallback dataset');
      return buildFallbackIndex();
    }
    
    const rows = parse(csv, { columns: true, skip_empty_lines: true });

    const byIATA = new Map();
    let validAirports = 0;
    
    for (const r of rows) {
      const code = (r.iata_code || '').trim().toUpperCase();
      if (!code) continue;
      
      byIATA.set(code, {
        iata: code,
        name: r.name || '',
        city: r.municipality || '',
        country: r.iso_country || '',
        continent: r.continent || '',
        tz: r.timezone || r.tz_database_time_zone || r.tz || null,
        lat: Number(r.latitude_deg),
        lon: Number(r.longitude_deg),
      });
      validAirports++;
    }
    
    console.log(`✅ Airport index built successfully: ${validAirports} airports with IATA codes`);
    return byIATA;
    
  } catch (error) {
    console.error('❌ Failed to build airport index from OurAirports, using fallback:', error.message);
    return buildFallbackIndex();
  }
}

function buildFallbackIndex() {
  console.log('🛫 Building fallback airport index...');
  
  const byIATA = new Map();
  FALLBACK_AIRPORTS.forEach(airport => {
    byIATA.set(airport.iata, {
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      continent: airport.continent,
      tz: airport.tz,
      lat: airport.lat,
      lon: airport.lon,
    });
  });
  
  console.log(`✅ Fallback airport index built successfully: ${byIATA.size} airports`);
  return byIATA;
}

module.exports = { buildAirportIndex };
