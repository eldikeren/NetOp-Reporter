const { DateTime } = require('luxon');

const num = v => {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

function hasProvenance(r){ return !!(r?._provenance?.snippet); }

function withinPeriod(dateStr, startISO, endISO) {
  if (!dateStr || dateStr === 'N/A') return true; // Allow rows without dates
  const formats = ['MM/dd/yyyy HH:mm', 'MM/dd/yyyy'];
  let dt = null;
  for (const f of formats) {
    const cand = DateTime.fromFormat(dateStr, f, { zone: 'utc' });
    if (cand.isValid) { dt = cand; break; }
  }
  if (!dt) return true; // Allow rows with invalid dates
  const s = DateTime.fromISO(startISO, { zone: 'utc' });
  const e = DateTime.fromISO(endISO, { zone: 'utc' }).endOf('day');
  return dt >= s && dt <= e;
}

function nonZeroErrors(r){ return num(r.Errors) > 0 || num(r['Error %']) > 0 || num(r.errors) > 0; }
function nonZeroOcc(r){
  return num(r.Occurrences) > 0 || num(r['Unreachable Count']) > 0 || num(r.Total) > 0 || num(r.occurrences) > 0;
}

module.exports = { hasProvenance, withinPeriod, nonZeroErrors, nonZeroOcc, num };
