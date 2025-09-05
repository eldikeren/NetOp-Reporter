// Debug script to test business hours analysis logic

// Mock data similar to what the AI would return for Dworkin
const mockFindings = [
  {
    summary_line: "Site Dworkin-CZ-Brno device DW-BRN-FW experienced 16 tunnel downtimes with an average duration of 504.42 minutes",
    severity: "major_issue",
    trend: "worsening_trend",
    last_occurrence: "09/02/2025 13:30",
    avg_duration_minutes: 504.42,
    total_occurrences: 16,
    business_hours_impact: "NO", // AI didn't set this correctly
    site_name: "Dworkin-CZ-Brno",
    device_name: "DW-BRN-FW"
  },
  {
    summary_line: "Site Dworkin-UK device UK-FW experienced 16 tunnel downtimes with an average duration of 509.09 minutes",
    severity: "major_issue",
    trend: "worsening_trend",
    last_occurrence: "09/02/2025 11:14",
    avg_duration_minutes: 509.09,
    total_occurrences: 16,
    business_hours_impact: "NO", // AI didn't set this correctly
    site_name: "Dworkin-UK",
    device_name: "UK-FW"
  }
];

// Test the timestamp detection logic
const allTimestampedEvents = mockFindings.filter(event => {
  if (!event.last_occurrence) return false;
  // Check if it has time component (HH:MM format) - support both "09/02/2025 13:30" and "13:30" formats
  // Also support "MM/DD/YYYY HH:MM" format that the AI is returning
  return /\d{1,2}:\d{2}/.test(event.last_occurrence) || /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(event.last_occurrence);
});

const totalAllEvents = allTimestampedEvents.length;

console.log('🔍 Debug Business Hours Analysis:');
console.log('📊 Mock findings:', mockFindings.length);
console.log('🕐 Timestamped events:', totalAllEvents);
console.log('📅 All timestamped events:', allTimestampedEvents);

// Test the ENHANCED business hours detection logic
const businessHoursEvents = allTimestampedEvents.filter(f => {
  // First check if AI explicitly set business_hours_impact to YES
  if (f.business_hours_impact === "YES") return true;
  
  // If AI didn't set it, automatically detect based on timestamp
  if (f.last_occurrence && /\d{1,2}:\d{2}/.test(f.last_occurrence)) {
    // Extract time from timestamp (e.g., "13:30" from "09/02/2025 13:30")
    const timeMatch = f.last_occurrence.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      // Business hours are 09:00-18:00 (9 AM to 6 PM)
      if (hour >= 9 && hour < 18) {
        return true;
      }
    }
  }
  return false;
}).length;

const businessHoursPercentage = totalAllEvents > 0 ? Math.round((businessHoursEvents / totalAllEvents) * 100) : 0;

console.log('🏢 Business hours events (enhanced detection):', businessHoursEvents);
console.log('📈 Business hours percentage:', businessHoursPercentage + '%');

// Test the condition
const shouldCreateBusinessHoursAnalysis = totalAllEvents > 0 || businessHoursEvents > 0;
console.log('✅ Should create business hours analysis:', shouldCreateBusinessHoursAnalysis);

if (shouldCreateBusinessHoursAnalysis) {
  const businessHoursAnalysis = {
    peak_incident_hours: '09:00-17:00',
    no_change_window: '02:00-04:00',
    backup_window: '01:00-03:00',
    total_events: totalAllEvents || 0,
    business_impact_events: businessHoursEvents || 0,
    no_business_hours_events: (totalAllEvents || 0) - (businessHoursEvents || 0),
    business_impact_percentage: businessHoursPercentage || 0,
    business_impact_events_list: allTimestampedEvents
      .filter(f => {
        // First check if AI explicitly set business_hours_impact to YES
        if (f.business_hours_impact === "YES") return true;
        
        // If AI didn't set it, automatically detect based on timestamp
        if (f.last_occurrence && /\d{1,2}:\d{2}/.test(f.last_occurrence)) {
          // Extract time from timestamp (e.g., "13:30" from "09/02/2025 13:30")
          const timeMatch = f.last_occurrence.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            // Business hours are 09:00-18:00 (9 AM to 6 PM)
            if (hour >= 9 && hour < 18) {
              return true;
            }
          }
        }
        return false;
      })
      .map(finding => ({
        event_description: finding.summary_line,
        business_impact: `This event affected business operations during work hours`,
        occurrence_time: finding.last_occurrence,
        duration_minutes: finding.avg_duration_minutes || 0,
        severity: finding.severity
      })),
    analysis_note: "Important: This analysis focuses on events with explicit time stamps and might not include all network events."
  };
  
  console.log('📋 Business hours analysis created:', businessHoursAnalysis);
} else {
  console.log('❌ Business hours analysis NOT created');
}
