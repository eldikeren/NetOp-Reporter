// Enhanced Signature Aviation Handler with IATA Timezone Conversion
// Uses API Ninjas to get accurate timezone information for airports

const { DateTime } = require('luxon');
const { iataLookup } = require('./iataClient');

// Cache for IATA lookups to avoid repeated API calls
const iataCache = new Map();

/**
 * Extract IATA code from Signature Aviation site name
 */
function extractIataFromSiteName(siteName) {
  if (!siteName) return null;
  
  // Look for SFS-XXX pattern
  const iataMatch = siteName.match(/SFS[-_\s]?([A-Z]{3})/);
  if (iataMatch) {
    return iataMatch[1];
  }
  
  return null;
}

/**
 * Get IATA information with caching
 */
async function getIataInfo(iataCode) {
  if (!iataCode) return null;
  
  // Check local cache first
  if (iataCache.has(iataCode)) {
    return iataCache.get(iataCode);
  }
  
  // Fetch from API Ninjas
  const info = await iataLookup(iataCode);
  if (info) {
    iataCache.set(iataCode, info);
  }
  
  return info;
}

/**
 * Convert UTC timestamp to local airport time
 */
function convertToLocalTime(utcTimestamp, timezone) {
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
      isBusinessHours: isBusinessHours(localTime)
    };
  } catch (error) {
    console.error(`Error converting time for ${timezone}:`, error);
    return null;
  }
}

/**
 * Check if time is during business hours (09:00-18:00, Mon-Fri)
 */
function isBusinessHours(localTime) {
  const isWeekday = localTime.weekday >= 1 && localTime.weekday <= 5;
  const hour = localTime.hour + localTime.minute / 60;
  return isWeekday && hour >= 9 && hour < 18;
}

/**
 * Process Signature Aviation events with IATA-based timezone conversion
 */
async function processSignatureAviationEvents(events) {
  console.log('🛫 Processing Signature Aviation events with IATA timezone conversion...');
  
  const processedEvents = [];
  
  for (const event of events) {
    const iataCode = extractIataFromSiteName(event.site_name);
    
    if (iataCode) {
      console.log(`🔍 Processing IATA code: ${iataCode} for site: ${event.site_name}`);
      
      // Get IATA information
      const iataInfo = await getIataInfo(iataCode);
      
      if (iataInfo && iataInfo.timezone) {
        console.log(`✅ Found IATA info for ${iataCode}: ${iataInfo.city}, ${iataInfo.country} (${iataInfo.timezone})`);
        
        // Convert UTC time to local time if timestamp exists
        if (event.last_occurrence) {
          const originalTime = event.last_occurrence;
          const timeConversion = convertToLocalTime(event.last_occurrence, iataInfo.timezone);
          
          if (timeConversion) {
            // Update event with local time information
            event.local_time = timeConversion.localTime;
            event.local_timezone = iataInfo.timezone;
            event.airport_city = iataInfo.city;
            event.airport_country = iataInfo.country;
            event.airport_name = iataInfo.airport;
            event.business_hours_impact = timeConversion.isBusinessHours ? 'YES' : 'NO';
            
            // Update last_occurrence to show local time
            event.last_occurrence = timeConversion.localTime;
            
            console.log(`🕐 Time converted: ${originalTime} UTC → ${timeConversion.localTime} ${iataInfo.timezone}`);
          }
        }
        
        // Update summary line to include airport information
        if (event.summary_line) {
          // Check if airport info is already added to prevent duplication
          if (!event.summary_line.includes('**(') && !event.summary_line.includes('Airport:')) {
            const airportDisplay = `${iataInfo.airport} - ${iataInfo.city}, ${iataInfo.country}`;
            event.summary_line = event.summary_line.replace(
              event.site_name,
              `${event.site_name} **(${airportDisplay})**`
            );
          }
        }
      } else {
        console.log(`⚠️ No timezone info found for IATA ${iataCode}`);
      }
    }
    
    processedEvents.push(event);
  }
  
  console.log(`✅ Processed ${processedEvents.length} Signature Aviation events with IATA timezone conversion`);
  return processedEvents;
}

/**
 * Generate enhanced Signature Aviation business impact analysis
 */
function generateSignatureAviationBusinessAnalysis(events) {
  const airportEvents = {};
  const businessHoursEvents = [];
  
  events.forEach(event => {
    const iataCode = extractIataFromSiteName(event.site_name);
    
    if (iataCode) {
      if (!airportEvents[iataCode]) {
        airportEvents[iataCode] = {
          total: 0,
          businessHours: 0,
          city: event.airport_city || 'Unknown',
          country: event.airport_country || 'Unknown',
          timezone: event.local_timezone || 'UTC'
        };
      }
      
      airportEvents[iataCode].total++;
      
      if (event.business_hours_impact === 'YES') {
        airportEvents[iataCode].businessHours++;
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
    airports_analyzed: Object.keys(airportEvents).length,
    airport_breakdown: airportEvents,
    business_impact_events_list: businessHoursEvents.map(event => ({
      event_description: event.summary_line,
      business_impact: `Airport business impact at ${event.airport_city || 'Unknown'}`,
      occurrence_time: event.last_occurrence,
      local_time: event.local_time,
      timezone: event.local_timezone,
      airport: event.airport_name,
      city: event.airport_city,
      country: event.airport_country,
      duration_minutes: event.avg_duration_minutes || 0,
      severity: event.severity
    })),
    analysis_note: "Important: This analysis focuses on events with explicit time stamps converted to local airport time zones using IATA code lookup."
  };
}

module.exports = {
  extractIataFromSiteName,
  getIataInfo,
  convertToLocalTime,
  isBusinessHours,
  processSignatureAviationEvents,
  generateSignatureAviationBusinessAnalysis
};