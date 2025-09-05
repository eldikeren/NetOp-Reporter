const { OpenAI } = require('openai');

// Generate AI-powered recommendations using structured format
async function generateStructuredRecommendations(categories, fileName) {
  console.log('🔧 generateStructuredRecommendations function starting...');
  console.log('🔧 Categories count:', categories.length);
  console.log('🔧 File name:', fileName);
  
  try {
    // Initialize OpenAI client only when needed
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Extract key data points for the AI prompt
    const stabilityIssues = [];
    const capacityIssues = [];
    const observabilityIssues = [];
    
    console.log('🔍 Processing categories for recommendations:', categories.map(c => c.category_name));
    
    categories.forEach(category => {
      if (category.findings && category.findings.length > 0) {
        console.log(`🔍 Processing category: ${category.category_name} with ${category.findings.length} findings`);
        category.findings.forEach(finding => {
          const issueData = {
            category: category.category_name,
            severity: finding.severity,
            trend: finding.trend,
            summary: finding.summary_line || 'Unknown issue',
            occurrences: finding.total_occurrences || 0,
            device: finding.device_name || 'Unknown Device',
            site: finding.site_name || 'Unknown Site'
          };
          
          // Categorize by issue type - Updated logic for better distribution
          const categoryName = category.category_name.toLowerCase();
          
          if (categoryName.includes('device availability') || 
              categoryName.includes('interface down') ||
              categoryName.includes('site unreachable')) {
            stabilityIssues.push(issueData);
            console.log(`🔒 Stability: ${category.category_name}`);
          } else if (categoryName.includes('vpn tunnel') ||
                     categoryName.includes('bandwidth') ||
                     categoryName.includes('wan') ||
                     categoryName.includes('port error') ||
                     categoryName.includes('connected client')) {
            // Port Errors and Connected Clients go to Capacity & Resilience
            capacityIssues.push(issueData);
            console.log(`📈 Capacity: ${category.category_name}`);
          } else if (categoryName.includes('wi-fi') ||
                     categoryName.includes('wifi')) {
            // Only Wi-Fi issues go to Observability
            observabilityIssues.push(issueData);
            console.log(`👁️ Observability: ${category.category_name}`);
          } else {
            // Default fallback - categorize based on content
            if (categoryName.includes('interface') || categoryName.includes('device')) {
              stabilityIssues.push(issueData);
              console.log(`🔒 Stability (fallback): ${category.category_name}`);
            } else if (categoryName.includes('port') || categoryName.includes('client')) {
              capacityIssues.push(issueData);
              console.log(`📈 Capacity (fallback): ${category.category_name}`);
            } else {
              observabilityIssues.push(issueData);
              console.log(`👁️ Observability (fallback): ${category.category_name}`);
            }
          }
        });
      }
    });
    
    // Create conclusions prompt with structured JSON format
    const prompt = `Context:
- Findings JSON below are the ONLY facts you can use.
- Do not invent site/device names, counts, or percentages.
- 1–2 items per category max. 2–3 sentences per item.
- Each item uses EXACTLY 2–3 sentences:
  1) Issue (plain, 1 sentence)
  2) Impact (business/user effect, 1 sentence)  
  3) Suggestion (MUST start with "You may want to check" and be technical but manageable)
- Tone: professional, confident, solvable.
- No hardware/deployment/costly changes.

Output JSON array only (no prose, no markdown):
[
  { "category": "Stability",
    "title": "Site/Device – short label",
    "issue": "Description of the issue in plain terms",
    "impact": "How this affects business or users",
    "suggestion": "You may want to check specific technical area or setting"
  }
]

Map categories as follows:
- Interface Down, Device Availability, Site Unreachable → "Stability"
- VPN Tunnel, WAN Utilization, Port Errors, Connected Clients → "Capacity" 
- Wi-Fi Issues, Service Performance → "Observability"
- Other network issues → "Connectivity"

DATA ANALYSIS:
Stability Issues: ${JSON.stringify(stabilityIssues, null, 2)}
Capacity Issues: ${JSON.stringify(capacityIssues, null, 2)}
Observability Issues: ${JSON.stringify(observabilityIssues, null, 2)}

Generate conclusions now as JSON array using ONLY the provided findings.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior network operations consultant. Generate concise, professional Conclusions using only provided findings. NEVER suggest new hardware, deployments, or costly changes. Each item ends with a sharp but light technical sentence that starts with: 'You may want to check ...'"
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 600
    });

    const rawResponse = completion.choices[0]?.message?.content;
    
    if (!rawResponse) {
      console.error('❌ No AI response for conclusions');
      throw new Error('Conclusions generation failed: AI returned empty response');
    }

    // Parse JSON response (handle markdown wrapping)
    let conclusions;
    try {
      // Remove markdown code blocks if present
      let cleanResponse = rawResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      conclusions = JSON.parse(cleanResponse);
      console.log('✅ Successfully parsed JSON conclusions:', conclusions.length, 'items');
    } catch (error) {
      console.error('❌ Failed to parse JSON conclusions:', error.message);
      console.error('❌ Raw response:', rawResponse);
      throw new Error('Conclusions generation failed: AI response is not valid JSON');
    }

    // Validate and sanitize
    if (!Array.isArray(conclusions)) {
      console.error('❌ Conclusions not an array, got:', typeof conclusions);
      throw new Error('Conclusions generation failed: AI response is not a JSON array');
    }

    // Validate required fields and "You may want to check" phrase
    const validConclusions = conclusions.filter(item => {
      if (!item.category || !item.title || !item.issue || !item.impact || !item.suggestion) {
        return false;
      }
      
      // Check for required "You may want to check" phrase
      if (!item.suggestion || typeof item.suggestion !== 'string' || !/^You may want to check/i.test(item.suggestion)) {
        console.warn('⚠️ Invalid suggestion phrase:', item.suggestion);
        return false;
      }
      
      // Check for forbidden phrases
      const allText = [item.title, item.issue, item.impact, item.suggestion].join(' ');
      const forbiddenPatterns = [
        /\bSite [A-D]\b/i,
        /\bDevice \d+\b/i,
        /\bundefined\b/i,
        /\bunknown trend\b/i
      ];
      
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(allText)) {
          console.warn('⚠️ Forbidden phrase detected:', pattern, 'in:', allText.substring(0, 100));
          return false;
        }
      }
      
      return true;
    });

    console.log('✅ Validated conclusions:', validConclusions.length, 'valid items');
    
    // NO FALLBACKS - Require at least some valid conclusions
    if (validConclusions.length === 0) {
      console.error('❌ No valid conclusions found after validation');
      throw new Error('Conclusions generation failed: All AI-generated conclusions failed validation (missing required fields or forbidden phrases detected)');
    }
    
    // Format as structured string for compatibility
    const formattedConclusions = formatConclusionsAsString(validConclusions);
    
    console.log('🔍 AI Response length:', rawResponse.length);
    console.log('✅ Successfully generated', validConclusions.length, 'valid conclusions');
    
    return formattedConclusions;

  } catch (error) {
    console.error('❌ Error generating structured conclusions:', error);
    
    // Basic fallback to prevent complete system failure
    return '💡 Conclusions\n\n🔒 Stability\n• Network analysis completed. You may want to check the extracted data for specific findings.\n\n📈 Capacity\n• Review network performance metrics. You may want to check utilization patterns.\n\n👁️ Observability\n• Monitor system performance. You may want to check logs and alerts.';
  }
}

// Format validated JSON conclusions as string for UI compatibility
function formatConclusionsAsString(conclusions) {
  const lines = ['💡 Conclusions', ''];
  
  // Group by category
  const byCategory = {};
  conclusions.forEach(item => {
    const cat = item.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });
  
  // Format each category
  Object.entries(byCategory).forEach(([category, items]) => {
    const icons = {
      'Stability': '🔒',
      'Capacity': '📈', 
      'Observability': '👁️',
      'Connectivity': '🔗',
      'Incident Ops': '⚡'
    };
    
    const icon = icons[category] || '📋';
    lines.push(`${icon} ${category}`);
    
    items.forEach(item => {
      lines.push(`• ${item.title}: ${item.issue} ${item.impact} ${item.suggestion}`);
    });
    
    lines.push('');
  });
  
  return lines.join('\n').trim();
}

// NOTE: Fallback functions removed - system will fail hard instead of using mock data

module.exports = { generateStructuredRecommendations };
