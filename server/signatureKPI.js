// Signature Aviation KPI Calculator
// Calculates Total Airports with Issues, Business Hours Impact, and Airport Operations Priority Index (AOPI)

// Airport tier definitions
const AIRPORT_TIERS = {
  TIER_1: [ // Major Hubs
    'London', 'New York', 'Paris', 'Los Angeles', 'Miami', 'Dallas', 'Chicago', 
    'Tokyo', 'Dubai', 'Singapore', 'Atlanta', 'JFK', 'ORD', 'LAX', 'MIA', 'DFW',
    'LHR', 'CDG', 'NRT', 'DXB', 'SIN'
  ],
  TIER_2: [ // Regional Hubs
    'Manchester', 'Berlin', 'Geneva', 'Madrid', 'Toronto', 'Boston', 'Zurich', 
    'Rome', 'Houston', 'San Francisco', 'YYZ', 'BOS', 'ZRH', 'FRA', 'MAD',
    'BCN', 'MXP', 'IAH', 'SFO', 'BWI'
  ]
};

// Helper function to determine airport tier
function getAirportTier(airportName) {
  const normalizedName = airportName.toLowerCase();
  
  // Check Tier 1
  if (AIRPORT_TIERS.TIER_1.some(tier1 => normalizedName.includes(tier1.toLowerCase()))) {
    return 1;
  }
  
  // Check Tier 2
  if (AIRPORT_TIERS.TIER_2.some(tier2 => normalizedName.includes(tier2.toLowerCase()))) {
    return 2;
  }
  
  // Default to Tier 3
  return 3;
}

// Calculate Signature Aviation KPIs
function calculateSignatureKPIs(events, airports) {
  console.log('🛫 Calculating Signature Aviation KPIs...');
  
  // Extract unique airports with issues
  const airportsWithIssues = new Set();
  const businessHoursAirports = new Set();
  const tierIncidents = { 1: 0, 2: 0, 3: 0 };
  
  events.forEach(event => {
    // Extract airport from site name (e.g., SFS-ATL -> ATL)
    const iataMatch = event.site_name?.match(/SFS[-_\s]?([A-Z]{3})/);
    if (iataMatch) {
      const iata = iataMatch[1];
      airportsWithIssues.add(iata);
      
      // Check if event occurred during business hours
      if (event.business_hours_impact === 'YES') {
        businessHoursAirports.add(iata);
      }
      
      // Find airport metadata to determine tier
      const airportMeta = airports.find(a => a.iata === iata);
      if (airportMeta) {
        const tier = getAirportTier(airportMeta.city || airportMeta.name);
        tierIncidents[tier]++;
      }
    }
  });
  
  // Calculate AOPI percentages
  const totalIncidents = Object.values(tierIncidents).reduce((sum, count) => sum + count, 0);
  const aopiBreakdown = {};
  
  if (totalIncidents > 0) {
    Object.keys(tierIncidents).forEach(tier => {
      const percentage = Math.round((tierIncidents[tier] / totalIncidents) * 100);
      aopiBreakdown[`Tier ${tier}`] = `${percentage}%`;
    });
  }
  
  // Format AOPI string
  const aopiString = Object.entries(aopiBreakdown)
    .map(([tier, percentage]) => `${tier}: ${percentage}`)
    .join(', ');
  
  const kpis = {
    total_airports_with_issues: airportsWithIssues.size,
    airports_affected_during_business_hours: businessHoursAirports.size,
    airport_operations_priority_index: aopiString || 'No incidents recorded',
    tier_breakdown: aopiBreakdown,
    total_incidents: totalIncidents
  };
  
  console.log(`✅ KPIs calculated: ${kpis.total_airports_with_issues} airports, ${kpis.airports_affected_during_business_hours} during business hours`);
  
  return kpis;
}

// Generate aviation narrative
function generateAviationNarrative(kpis) {
  const { total_airports_with_issues, airports_affected_during_business_hours, airport_operations_priority_index } = kpis;
  
  let narrative = `Analysis of ${total_airports_with_issues} Signature Aviation airports revealed network infrastructure challenges. `;
  
  if (airports_affected_during_business_hours > 0) {
    narrative += `${airports_affected_during_business_hours} airports experienced incidents during business hours, potentially affecting ground handling and administrative workflows. `;
  }
  
  if (airport_operations_priority_index.includes('Tier 1')) {
    const tier1Match = airport_operations_priority_index.match(/Tier 1: (\d+)%/);
    if (tier1Match) {
      const tier1Percentage = tier1Match[1];
      narrative += `Incident concentration shows ${tier1Percentage}% occurring in Tier 1 major hubs, concentrating operational risk in critical global nodes.`;
    }
  } else {
    narrative += 'Incidents were distributed across airport tiers, indicating widespread infrastructure challenges.';
  }
  
  return narrative;
}

// Create dashboard table format
function createDashboardTable(kpis) {
  return [
    { "KPI": "Total Airports with Issues", "Value": kpis.total_airports_with_issues.toString() },
    { "KPI": "Airports Affected During Business Hours", "Value": kpis.airports_affected_during_business_hours.toString() },
    { "KPI": "Airport Operations Priority Index", "Value": kpis.airport_operations_priority_index }
  ];
}

// Main function to generate complete Signature Aviation report
function generateSignatureAviationReport(events, airports) {
  const kpis = calculateSignatureKPIs(events, airports);
  const narrative = generateAviationNarrative(kpis);
  const dashboardTable = createDashboardTable(kpis);
  
  return {
    dashboard_table: dashboardTable,
    narrative: narrative,
    kpis: kpis,
    charts: [
      {
        title: "Incidents by Airport Tier",
        type: "pie",
        data: "Distribution of incidents across Tier 1, Tier 2, Tier 3"
      },
      {
        title: "Airports vs Incidents",
        type: "bar", 
        data: "Number of incidents per airport (x-axis = airport, y-axis = incident count)"
      },
      {
        title: "Incident Timeline",
        type: "line",
        data: "Incidents over time (x-axis = hour of day, y-axis = incident count), highlight business hours window"
      }
    ]
  };
}

module.exports = {
  calculateSignatureKPIs,
  generateAviationNarrative,
  createDashboardTable,
  generateSignatureAviationReport,
  getAirportTier
};
