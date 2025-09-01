const pdfParse = require('pdf-parse');

// SFS-XXX, SFS XXX, or just XXX (we validate against the airport index)
const RE_SFS = /SFS[-_\s]?([A-Z]{3})\b/g;
const RE_LOOSE = /\b([A-Z]{3})\b/g;

function* findIata(text, index) {
  const seen = new Set();
  
  // First try SFS patterns (Signature Aviation specific)
  for (const re of [RE_SFS, RE_LOOSE]) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const code = m[1].toUpperCase();
      if (index.has(code) && !seen.has(code)) { 
        seen.add(code); 
        yield code; 
      }
    }
  }
}

async function extractAirportsFromPdf(buffer, index) {
  console.log('🔍 Extracting airports from Signature Aviation PDF...');
  
  try {
    const { text } = await pdfParse(buffer);
    if (!text || !text.trim()) {
      console.log('⚠️ No text content found in PDF');
      return [];
    }
    
    const codes = Array.from(findIata(text, index));
    const airports = codes.map(c => index.get(c));
    
    console.log(`✅ Extracted ${airports.length} airports from PDF: ${codes.join(', ')}`);
    return airports;
    
  } catch (error) {
    console.error('❌ Failed to extract airports from PDF:', error.message);
    throw new Error(`Failed to extract airports: ${error.message}`);
  }
}

module.exports = { extractAirportsFromPdf };
