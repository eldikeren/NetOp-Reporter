#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST SCRIPT
 * 
 * Tests that the email copy matches the UI exactly:
 * 1. Event styling (severity badges, trend indicators, business hours flags)
 * 2. Business hours component presence
 * 3. Recommendations styling
 * 4. SLA column data integration
 * 5. Multi-PDF vs Single PDF consistency
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 COMPREHENSIVE EMAIL-UI MATCHING TEST');
console.log('=======================================\n');

// Test 1: Check if getFindingHTML function is globally available
console.log('✅ Test 1: Global getFindingHTML Function');
try {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const emailUtilsContent = fs.readFileSync(emailUtilsPath, 'utf8');
    
    // Check if function is defined globally (outside any other function)
    const globalFunctionMatch = emailUtilsContent.match(/^const getFindingHTML = \(finding: any, category: any\) =>/m);
    if (globalFunctionMatch) {
        console.log('   ✅ getFindingHTML is defined globally');
    } else {
        console.log('   ❌ getFindingHTML is NOT defined globally');
    }
    
    // Check if it's used in both single and combined email functions
    const combinedUsage = emailUtilsContent.includes('generateCombinedEmailBodyHTML') && 
                         emailUtilsContent.includes('${category.findings.map((finding: any) => getFindingHTML(finding, category)).join(\'\')}');
    
    if (combinedUsage) {
        console.log('   ✅ getFindingHTML is used in combined email function');
    } else {
        console.log('   ❌ getFindingHTML is NOT used in combined email function');
    }
    
} catch (error) {
    console.log('   ❌ Error reading emailUtils.ts:', error.message);
}

// Test 2: Check severity mapping consistency with UI
console.log('\n✅ Test 2: Severity Mapping Consistency');
try {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const categoryPath = path.join(__dirname, '../client/src/components/analysis/CategorySection.tsx');
    
    const emailContent = fs.readFileSync(emailUtilsPath, 'utf8');
    const categoryContent = fs.readFileSync(categoryPath, 'utf8');
    
    // Check if severity icons match
    const emailMajor = emailContent.includes("major_issue: {") && emailContent.includes("icon: '🚨'");
    const categoryMajor = categoryContent.includes("major_issue: {") && categoryContent.includes("icon: '🚨'");
    
    if (emailMajor && categoryMajor) {
        console.log('   ✅ Major issue severity icons match between email and UI');
    } else {
        console.log('   ❌ Major issue severity icons DO NOT match');
    }
    
    // Check trend icons
    const emailWorsening = emailContent.includes("worsening_trend: {") && emailContent.includes("icon: '↗️'");
    const categoryWorsening = categoryContent.includes("worsening_trend: {") && categoryContent.includes("icon: '↗️'");
    
    if (emailWorsening && categoryWorsening) {
        console.log('   ✅ Worsening trend icons match between email and UI');
    } else {
        console.log('   ❌ Worsening trend icons DO NOT match');
    }
    
} catch (error) {
    console.log('   ❌ Error checking severity mapping:', error.message);
}

// Test 3: Check business hours flag detection
console.log('\n✅ Test 3: Business Hours Flag Detection');
try {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const emailContent = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const hasEnhancedDetection = emailContent.includes('hasBusinessHoursImpact') &&
                                emailContent.includes("finding.business_hours_impact === 'YES'") &&
                                emailContent.includes("finding.summary_line.includes('🕐 AFFECTING BUSINESS HOURS')");
    
    if (hasEnhancedDetection) {
        console.log('   ✅ Enhanced business hours detection is implemented');
    } else {
        console.log('   ❌ Enhanced business hours detection is MISSING');
    }
    
    const hasDebugLogging = emailContent.includes("console.log('🕐 Business hours impact detected");
    if (hasDebugLogging) {
        console.log('   ✅ Business hours debug logging is enabled');
    } else {
        console.log('   ❌ Business hours debug logging is MISSING');
    }
    
} catch (error) {
    console.log('   ❌ Error checking business hours detection:', error.message);
}

// Test 4: Check business hours component in combined email
console.log('\n✅ Test 4: Business Hours Component in Combined Email');
try {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const emailContent = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const hasBusinessHoursInCombined = emailContent.includes('generateCombinedEmailBodyHTML') &&
                                      emailContent.includes('analysis_result.business_hours_analysis') &&
                                      emailContent.includes('total_events > 0');
    
    if (hasBusinessHoursInCombined) {
        console.log('   ✅ Business hours component is included in combined email');
    } else {
        console.log('   ❌ Business hours component is MISSING from combined email');
    }
    
} catch (error) {
    console.log('   ❌ Error checking combined email business hours:', error.message);
}

// Test 5: Check SLA column integration requirement
console.log('\n✅ Test 5: SLA Column Integration Status');
try {
    const serverIndexPath = path.join(__dirname, 'index.js');
    const serverContent = fs.readFileSync(serverIndexPath, 'utf8');
    
    // Check if Service Performance category is renamed to include SLA
    const hasRenamedCategory = serverContent.includes('Service Performance & SLA') ||
                              serverContent.includes('Service Performance Incidents') ||
                              serverContent.includes('SLA Profiles');
    
    if (hasRenamedCategory) {
        console.log('   ✅ Service Performance category shows evidence of SLA integration');
    } else {
        console.log('   ❌ SLA column integration appears to be MISSING');
        console.log('   📝 TODO: Implement SLA column data extraction and integration');
    }
    
} catch (error) {
    console.log('   ❌ Error checking SLA integration:', error.message);
}

// Test 6: Check recommendations styling
console.log('\n✅ Test 6: Recommendations Styling');
try {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const emailContent = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const hasStyledRecommendations = emailContent.includes('recommendationsHtml') &&
                                    (emailContent.includes('🔒') || emailContent.includes('📈') || emailContent.includes('👁️'));
    
    if (hasStyledRecommendations) {
        console.log('   ✅ Recommendations styling with emojis is implemented');
    } else {
        console.log('   ❌ Recommendations styling needs improvement');
    }
    
} catch (error) {
    console.log('   ❌ Error checking recommendations styling:', error.message);
}

console.log('\n🎯 SUMMARY');
console.log('==========');
console.log('If any tests show ❌, those are the exact issues to fix.');
console.log('All tests should show ✅ for perfect email-UI matching.');
console.log('\n📧 To test manually:');
console.log('1. Generate visuals for reports');
console.log('2. Copy All reports');
console.log('3. Check console for debug output');
console.log('4. Paste into Gmail and compare with UI');

console.log('\n🔧 Next Steps:');
console.log('- Fix any ❌ issues above');
console.log('- Implement SLA column integration');
console.log('- Test with actual PDFs');
console.log('- Verify business hours component appears');
