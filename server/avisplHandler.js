// AVI-SPL Handler for Multi-Global Location Analysis
// Processes city names from site names and converts UTC to local time

const { DateTime } = require('luxon');

// Global city to timezone mapping
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

// Extract city name from site name
function extractCityFromSiteName(siteName) {
  if (!siteName) return null;
  
  const normalizedSite = siteName.toLowerCase();
  console.log(`🔍 Checking site name: "${siteName}" (normalized: "${normalizedSite}")`);
  
  // Find matching city in the timezone map
  for (const [city, timezone] of Object.entries(CITY_TIMEZONE_MAP)) {
    if (normalizedSite.includes(city)) {
      console.log(`✅ Found city match: "${city}" with timezone "${timezone}" for site "${siteName}"`);
      return { city: city, timezone: timezone };
    }
  }
  
  console.log(`❌ No city match found for site "${siteName}"`);
  return null;
}

// Check if timestamp is during business hours in local timezone
function isBusinessHoursAviSpl(utcTimestamp, cityTimezone, businessWindow = { start: 9, end: 18 }) {
  if (!utcTimestamp || !cityTimezone) return false;
  
  try {
    const localTime = DateTime.fromISO(utcTimestamp, { zone: 'utc' }).setZone(cityTimezone);
    const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
    const hour = localTime.hour + localTime.minute / 60;
    
    return isWeekday && hour >= businessWindow.start && hour < businessWindow.end;
  } catch (error) {
    console.error('Error converting timezone for AVI-SPL:', error);
    return false;
  }
}

// Process AVI-SPL events with city-based timezone conversion
function processAviSplEvents(events) {
  console.log('🌍 Processing AVI-SPL multi-global location events...');
  
  const processedEvents = events.map(event => {
    const cityInfo = extractCityFromSiteName(event.site_name);
    
    if (cityInfo) {
      // Add city information to the event
      event.geo_location = cityInfo.city;
      event.local_timezone = cityInfo.timezone;
      
      // Check business hours impact if timestamp exists
      if (event.last_occurrence) {
        const isBusinessHours = isBusinessHoursAviSpl(event.last_occurrence, cityInfo.timezone);
        event.business_hours_impact = isBusinessHours ? 'YES' : 'NO';
        
        // Add local time string and update last_occurrence
        try {
          console.log(`🕐 Converting UTC time "${event.last_occurrence}" to ${cityInfo.timezone} for ${cityInfo.city}`);
          const localTime = DateTime.fromISO(event.last_occurrence, { zone: 'utc' }).setZone(cityInfo.timezone);
          const originalTime = event.last_occurrence;
          event.local_time = localTime.toFormat('MM/dd/yyyy HH:mm');
          event.local_timezone_name = localTime.zoneName;
          // Update last_occurrence to show local time for display
          event.last_occurrence = localTime.toFormat('MM/dd/yyyy HH:mm');
          console.log(`✅ Time converted: ${originalTime} UTC → ${event.last_occurrence} ${cityInfo.timezone}`);
        } catch (error) {
          console.error('Error formatting local time:', error);
        }
      }
      
      // Update summary line to include city name
      if (event.summary_line) {
        event.summary_line = event.summary_line.replace(
          event.site_name,
          `${event.site_name} **(${cityInfo.city.charAt(0).toUpperCase() + cityInfo.city.slice(1)})**`
        );
      }
    }
    
    return event;
  });
  
  console.log(`✅ Processed ${processedEvents.length} AVI-SPL events with global location analysis`);
  return processedEvents;
}

// Generate AVI-SPL business hours analysis
function generateAviSplBusinessAnalysis(events) {
  const cityEvents = {};
  const businessHoursEvents = [];
  
  events.forEach(event => {
    if (event.geo_location) {
      if (!cityEvents[event.geo_location]) {
        cityEvents[event.geo_location] = {
          total: 0,
          businessHours: 0,
          timezone: event.local_timezone
        };
      }
      
      cityEvents[event.geo_location].total++;
      
      if (event.business_hours_impact === 'YES') {
        cityEvents[event.geo_location].businessHours++;
        businessHoursEvents.push(event);
      }
    }
  });
  
  const totalEvents = events.length;
  const totalBusinessHoursEvents = businessHoursEvents.length;
  const businessHoursPercentage = totalEvents > 0 ? Math.round((totalBusinessHoursEvents / totalEvents) * 100) : 0;
  
  return {
    total_events: totalEvents,
    business_impact_events: totalBusinessHoursEvents,
    no_business_hours_events: totalEvents - totalBusinessHoursEvents,
    business_impact_percentage: businessHoursPercentage,
    cities_analyzed: Object.keys(cityEvents).length,
    city_breakdown: cityEvents,
    business_impact_events_list: businessHoursEvents.map(event => ({
      event_description: event.summary_line,
      business_impact: `Global business impact in ${event.geo_location}`,
      occurrence_time: event.last_occurrence,
      local_time: event.local_time,
      timezone: event.local_timezone_name,
      duration_minutes: event.avg_duration_minutes || 0,
      severity: event.severity
    })),
    analysis_note: "Important: This analysis focuses on events with explicit time stamps converted to local time zones based on city detection from site names."
  };
}

module.exports = {
  extractCityFromSiteName,
  isBusinessHoursAviSpl,
  processAviSplEvents,
  generateAviSplBusinessAnalysis,
  CITY_TIMEZONE_MAP
};
