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
  'phoenix': 'America/Phoenix',
  'ft lauderdale': 'America/New_York',
  'jacksonville': 'America/New_York',
  'pittsburgh': 'America/New_York',
  'houston': 'America/Chicago',
  'detroit': 'America/New_York',
  'seattle': 'America/Los_Angeles',
  'boston': 'America/New_York',
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

// Convert UTC timestamp to local time (robust parsing)
function convertToLocalTimeAviSpl(utcTimestamp, timezone) {
  if (!utcTimestamp || !timezone) return null;
  
  try {
    // Handle different timestamp formats
    let localTime;
    
    // Check if it's already in ISO format (contains T or Z)
    if (utcTimestamp.includes('T') || utcTimestamp.includes('Z')) {
      localTime = DateTime.fromISO(utcTimestamp, { zone: 'utc' }).setZone(timezone);
    } else if (utcTimestamp.includes(' ')) {
      // Handle MM/DD/YYYY HH:mm format
      const [datePart, timePart] = utcTimestamp.split(' ');
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        const isoString = `${year}-${month}-${day}T${timePart}:00.000Z`;
        localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
      } else {
        console.error(`Unsupported timestamp format: ${utcTimestamp}`);
        return null;
      }
    } else {
      // Handle MM/DD/YYYY format - convert to ISO first
      const parts = utcTimestamp.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        const isoString = `${year}-${month}-${day}T00:00:00.000Z`;
        localTime = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
      } else {
        console.error(`Unsupported timestamp format: ${utcTimestamp}`);
        return null;
      }
    }
    
    return {
      localTime: localTime.toFormat('MM/dd/yyyy HH:mm'),
      timezone: timezone,
      isBusinessHours: isBusinessHoursAviSpl(localTime)
    };
  } catch (error) {
    console.error(`Error converting time for ${timezone}:`, error);
    return null;
  }
}

// Check if time is during business hours (09:00-18:00, Mon-Fri)
function isBusinessHoursAviSpl(localTime, businessWindow = { start: 9, end: 18 }) {
  if (!localTime) return false;
  
  const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
  const hour = localTime.hour + localTime.minute / 60;
  return isWeekday && hour >= businessWindow.start && hour < businessWindow.end;
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
        console.log(`🕐 Converting UTC time "${event.last_occurrence}" to ${cityInfo.timezone} for ${cityInfo.city}`);
        const timeConversion = convertToLocalTimeAviSpl(event.last_occurrence, cityInfo.timezone);
        
        if (timeConversion) {
          const originalTime = event.last_occurrence;
          event.local_time = timeConversion.localTime;
          event.local_timezone_name = timeConversion.timezone;
          event.business_hours_impact = timeConversion.isBusinessHours ? 'YES' : 'NO';
          
          // Update last_occurrence to show local time for display
          event.last_occurrence = timeConversion.localTime;
          console.log(`✅ Time converted: ${originalTime} UTC → ${timeConversion.localTime} ${cityInfo.timezone}`);
        } else {
          console.log(`⚠️ Failed to convert time for ${event.site_name}`);
          event.business_hours_impact = 'NO';
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
