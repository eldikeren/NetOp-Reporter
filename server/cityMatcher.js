// Enhanced City Matcher for AVI-SPL Reports
// Handles edge cases and provides robust city-to-timezone mapping

const CITY_TIMEZONE_MAP = {
  // Americas
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'edmonton': 'America/Edmonton',
  'calgary': 'America/Edmonton',
  'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'phoenix': 'America/Phoenix',
  'ft lauderdale': 'America/New_York',
  'fort lauderdale': 'America/New_York',
  'jacksonville': 'America/New_York',
  'pittsburgh': 'America/New_York',
  'houston': 'America/Chicago',
  'detroit': 'America/New_York',
  'seattle': 'America/Los_Angeles',
  'boston': 'America/New_York',
  'washington': 'America/New_York',
  'washington dc': 'America/New_York',
  'denver': 'America/Denver',
  'dublin': 'Europe/Dublin',
  
  // Europe
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'madrid': 'Europe/Madrid',
  'rome': 'Europe/Rome',
  'amsterdam': 'Europe/Amsterdam',
  'zurich': 'Europe/Zurich',
  'stockholm': 'Europe/Stockholm',
  'moscow': 'Europe/Moscow',
  'frankfurt': 'Europe/Berlin',
  
  // Asia Pacific
  'tokyo': 'Asia/Tokyo',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'mumbai': 'Asia/Kolkata',
  'dubai': 'Asia/Dubai',
  'shanghai': 'Asia/Shanghai',
  'seoul': 'Asia/Seoul',
  'bangkok': 'Asia/Bangkok'
};

// Aliases for common variations
const ALIASES = new Map([
  ['ft lauderdale', 'fort lauderdale'],
  ['washington dc', 'washington'],
  ['la', 'los angeles'],
  ['nyc', 'new york'],
  ['boston vl', 'boston'],
  ['chicago warehouse', 'chicago'],
  ['phoenix qcc', 'phoenix']
]);

// Sites to ignore (datacenters, generic names, etc.)
const IGNORE_SITES = new Set([
  'multiple sites', 
  'global', 
  'hq', 
  'flexential', 
  'colo', 
  'datacenter',
  'data center',
  'headquarters',
  'main office',
  'primary site'
]);

/**
 * Normalize site name for matching
 */
function normalizeSiteName(siteName) {
  if (!siteName) return '';
  return String(siteName).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Resolve city name from site name using aliases and heuristics
 */
function resolveCityName(siteRaw) {
  const normalized = normalizeSiteName(siteRaw);
  if (!normalized || IGNORE_SITES.has(normalized)) {
    return null;
  }

  // Check aliases first
  const alias = ALIASES.get(normalized);
  if (alias) {
    return alias;
  }

  // Check exact match
  if (CITY_TIMEZONE_MAP[normalized]) {
    return normalized;
  }

  // Heuristic: extract first meaningful word (drop qualifiers)
  const words = normalized.split(' ');
  if (words.length > 1) {
    const firstWord = words[0];
    if (firstWord.length >= 3 && CITY_TIMEZONE_MAP[firstWord]) {
      return firstWord;
    }
  }

  // Check if any word in the site name matches a city
  for (const word of words) {
    if (word.length >= 3 && CITY_TIMEZONE_MAP[word]) {
      return word;
    }
  }

  return null;
}

/**
 * Find timezone for a site name
 */
function findTimezoneFromSite(siteName) {
  const cityName = resolveCityName(siteName);
  if (!cityName) {
    return null;
  }

  return CITY_TIMEZONE_MAP[cityName] || null;
}

/**
 * Extract city info from site name
 */
function extractCityFromSiteName(siteName) {
  if (!siteName) return null;
  
  const normalizedSite = normalizeSiteName(siteName);
  console.log(`🔍 Checking site name: "${siteName}" (normalized: "${normalizedSite}")`);
  
  // Check if it's an ignored site
  if (IGNORE_SITES.has(normalizedSite)) {
    console.log(`⏭️ Ignoring site: "${siteName}" (generic/datacenter name)`);
    return null;
  }
  
  // Find matching city
  const cityName = resolveCityName(siteName);
  if (cityName) {
    const timezone = CITY_TIMEZONE_MAP[cityName];
    console.log(`✅ Found city match: "${cityName}" with timezone "${timezone}" for site "${siteName}"`);
    return { city: cityName, timezone: timezone };
  }
  
  console.log(`❌ No city match found for site "${siteName}"`);
  return null;
}

module.exports = {
  extractCityFromSiteName,
  findTimezoneFromSite,
  resolveCityName,
  normalizeSiteName,
  CITY_TIMEZONE_MAP,
  ALIASES,
  IGNORE_SITES
};
