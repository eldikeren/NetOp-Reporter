const { DateTime } = require('luxon');

// isoUtc is an ISO string in UTC (e.g. "2025-08-30T14:05:00Z")
// tz is IANA zone string (e.g. "America/New_York")
function isBusinessHoursLocal(isoUtc, tz, window = { start: 9, end: 18 }) {
  if (!isoUtc || !tz) return false;
  
  try {
    // If your timestamps already include an offset (e.g. +01:00), do:
    // const local = DateTime.fromISO(isoUtc, { setZone: true }).setZone(tz);
    const local = DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(tz);
    const weekday = local.weekday; // 1..7 (Mon..Sun)
    
    if (weekday < 1 || weekday > 5) return false; // Weekend
    
    const hourFloat = local.hour + local.minute / 60;
    return hourFloat >= window.start && hourFloat < window.end;
    
  } catch (error) {
    console.warn(`⚠️ Error calculating business hours for ${isoUtc} in ${tz}:`, error.message);
    return false;
  }
}

// Helper function to get local time string for an airport
function getLocalTimeString(isoUtc, tz) {
  if (!isoUtc || !tz) return null;
  
  try {
    const local = DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(tz);
    return local.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
  } catch (error) {
    console.warn(`⚠️ Error converting time for ${isoUtc} in ${tz}:`, error.message);
    return null;
  }
}

module.exports = { isBusinessHoursLocal, getLocalTimeString };
