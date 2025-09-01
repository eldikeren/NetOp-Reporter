const multer = require('multer');
const express = require('express');
const { buildAirportIndex } = require('./airportsIndex');
const { extractAirportsFromPdf } = require('./extractAirportsFromPdf');
const { isBusinessHoursLocal, getLocalTimeString } = require('./businessHours');

const upload = multer();

let AIRPORTS = null;
async function ensureAirportIndex() {
  if (!AIRPORTS) {
    console.log('🛫 Initializing airport index...');
    AIRPORTS = await buildAirportIndex();
  }
}

function groupByGeo(list) {
  const out = {};
  for (const a of list) {
    const cont = a.continent || 'UNK';
    const country = a.country || 'UNK';
    (out[cont] ??= {});
    (out[cont][country] ??= []);
    out[cont][country].push(a);
  }
  return out;
}

// Helper: attach business hours flags to events
function attachBHToEvents(rows, airportIndex) {
  return rows.map(r => {
    const code = (r.iata || r.airport || '').toUpperCase();
    const meta = airportIndex.get(code) || null;
    const tz = meta?.tz || null;
    const bh = r.timestamp ? isBusinessHoursLocal(r.timestamp, tz) : false;
    const localTime = r.timestamp ? getLocalTimeString(r.timestamp, tz) : null;
    
    return { 
      ...r, 
      airport_meta: meta, 
      local_tz: tz, 
      local_time: localTime,
      business_hours_impact: bh ? 'YES' : 'NO' 
    };
  });
}

// Helper: create business hours analysis summary
function createBusinessHoursAnalysis(events) {
  const totalEvents = events.length;
  const businessHoursEvents = events.filter(e => e.business_hours_impact === 'YES').length;
  const businessHoursPercentage = totalEvents > 0 ? Math.round((businessHoursEvents / totalEvents) * 100) : 0;
  
  // Group by airport for impact analysis
  const airportImpact = {};
  events.forEach(event => {
    const airport = event.airport_meta?.iata || 'UNKNOWN';
    if (!airportImpact[airport]) {
      airportImpact[airport] = { total: 0, businessHours: 0 };
    }
    airportImpact[airport].total++;
    if (event.business_hours_impact === 'YES') {
      airportImpact[airport].businessHours++;
    }
  });
  
  // Find airports with highest business hours impact
  const highImpactAirports = Object.entries(airportImpact)
    .filter(([_, stats]) => stats.businessHours > 0)
    .sort(([_, a], [__, b]) => b.businessHours - a.businessHours)
    .slice(0, 5)
    .map(([airport, stats]) => ({
      airport,
      total_events: stats.total,
      business_hours_events: stats.businessHours,
      impact_percentage: Math.round((stats.businessHours / stats.total) * 100)
    }));
  
  return {
    total_events: totalEvents,
    business_hours_events: businessHoursEvents,
    business_hours_percentage: businessHoursPercentage,
    high_impact_airports: highImpactAirports,
    business_hours_events_list: events
      .filter(e => e.business_hours_impact === 'YES')
      .map(e => ({
        event_description: e.summary_line || e.description || 'Network event',
        business_impact: `Event occurred during business hours at ${e.airport_meta?.name || e.iata}`,
        occurrence_time: e.local_time || e.timestamp,
        duration_minutes: e.avg_duration_minutes || e.duration_minutes || 0,
        severity: e.severity || 'unknown',
        airport: e.airport_meta?.iata || e.iata,
        timezone: e.local_tz
      }))
  };
}

module.exports = (app) => {
  // 1) Airports only (from Signature PDF)
  app.post('/api/signature/airports', upload.single('pdf'), async (req, res) => {
    try {
      await ensureAirportIndex();
      
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }
      
      const airports = await extractAirportsFromPdf(req.file.buffer, AIRPORTS);
      
      return res.json({
        customer: 'Signature Aviation',
        generated_at: new Date().toISOString(),
        airports_count: airports.length,
        grouped: groupByGeo(airports),
        airports: airports.map(a => ({
          iata: a.iata,
          name: a.name,
          city: a.city,
          country: a.country,
          continent: a.continent,
          timezone: a.tz,
          coordinates: { lat: a.lat, lon: a.lon }
        }))
      });
      
    } catch (e) {
      console.error('❌ Signature airports endpoint error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 2) Airports + Business-hours on timestamped events
  app.post('/api/signature/airports-with-events', upload.fields([{ name:'pdf' }, { name:'events' }]), async (req, res) => {
    try {
      await ensureAirportIndex();
      
      const buffer = req.files?.pdf?.[0]?.buffer;
      const airports = buffer ? await extractAirportsFromPdf(buffer, AIRPORTS) : [];
      
      let events = [];
      if (req.body?.events) {
        try {
          events = JSON.parse(req.body.events);
        } catch (parseError) {
          console.warn('⚠️ Failed to parse events JSON:', parseError.message);
        }
      }
      
      const eventsFlagged = attachBHToEvents(events, AIRPORTS);
      const businessHoursAnalysis = createBusinessHoursAnalysis(eventsFlagged);
      
      return res.json({
        customer: 'Signature Aviation',
        generated_at: new Date().toISOString(),
        airports_count: airports.length,
        grouped: groupByGeo(airports),
        airports: airports.map(a => ({
          iata: a.iata,
          name: a.name,
          city: a.city,
          country: a.country,
          continent: a.continent,
          timezone: a.tz,
          coordinates: { lat: a.lat, lon: a.lon }
        })),
        events: eventsFlagged,
        business_hours_analysis: businessHoursAnalysis
      });
      
    } catch (e) {
      console.error('❌ Signature airports-with-events endpoint error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 3) Business hours analysis only (for existing events)
  app.post('/api/signature/business-hours', express.json(), async (req, res) => {
    try {
      await ensureAirportIndex();
      
      const { events } = req.body;
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Events array is required' });
      }
      
      const eventsFlagged = attachBHToEvents(events, AIRPORTS);
      const businessHoursAnalysis = createBusinessHoursAnalysis(eventsFlagged);
      
      return res.json({
        customer: 'Signature Aviation',
        generated_at: new Date().toISOString(),
        events: eventsFlagged,
        business_hours_analysis: businessHoursAnalysis
      });
      
    } catch (e) {
      console.error('❌ Signature business-hours endpoint error:', e);
      res.status(500).json({ error: e.message });
    }
  });
};
