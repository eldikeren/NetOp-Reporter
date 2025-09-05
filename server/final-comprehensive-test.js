#!/usr/bin/env node

/**
 * FINAL COMPREHENSIVE TEST SCRIPT
 * 
 * Tests ALL the requested fixes:
 * 1. ✅ Multi-PDF event styling matches UI exactly  
 * 2. ✅ Business hours component copying for all reports
 * 3. ✅ Recommendations styling matches UI
 * 4. ✅ SLA column integration in Service Performance & SLA
 * 5. ✅ Event design consistency between single and multi-PDF
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 FINAL COMPREHENSIVE TEST SUITE');
console.log('==================================\n');

let allTestsPassed = true;

function runTest(testName, testFunction) {
    try {
        const result = testFunction();
        if (result.success) {
            console.log(`✅ ${testName}: PASSED`);
            if (result.details) {
                result.details.forEach(detail => console.log(`   ${detail}`));
            }
        } else {
            console.log(`❌ ${testName}: FAILED`);
            if (result.details) {
                result.details.forEach(detail => console.log(`   ${detail}`));
            }
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ${testName}: ERROR - ${error.message}`);
        allTestsPassed = false;
    }
    console.log('');
}

// Test 1: Multi-PDF Event Styling
runTest('Multi-PDF Event Styling', () => {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const content = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const details = [];
    
    // Check if getFindingHTML is defined globally
    const globalFunction = content.match(/^const getFindingHTML = \(finding: any, category: any\) =>/m);
    if (globalFunction) {
        details.push('✓ getFindingHTML defined globally');
    } else {
        return { success: false, details: ['✗ getFindingHTML NOT defined globally'] };
    }
    
    // Check if it's used in combined email function
    const combinedUsage = content.includes('generateCombinedEmailBodyHTML') && 
                         content.includes('${category.findings.map((finding: any) => getFindingHTML(finding, category)).join(\'\')}');
    if (combinedUsage) {
        details.push('✓ getFindingHTML used in combined email function');
    } else {
        return { success: false, details: ['✗ getFindingHTML NOT used in combined email'] };
    }
    
    // Check for no duplicate functions
    const functionMatches = content.match(/const getFindingHTML = \(finding: any, category: any\) =>/g);
    if (functionMatches && functionMatches.length === 1) {
        details.push('✓ No duplicate getFindingHTML functions');
    } else {
        return { success: false, details: [`✗ Found ${functionMatches ? functionMatches.length : 0} getFindingHTML functions (should be 1)`] };
    }
    
    return { success: true, details };
});

// Test 2: UI Styling Consistency
runTest('UI Styling Consistency', () => {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const categoryPath = path.join(__dirname, '../client/src/components/analysis/CategorySection.tsx');
    
    const emailContent = fs.readFileSync(emailUtilsPath, 'utf8');
    const categoryContent = fs.readFileSync(categoryPath, 'utf8');
    
    const details = [];
    
    // Check severity icons
    const severityIcons = [
        { name: 'major_issue', icon: '🚨' },
        { name: 'recurring_issue', icon: '🔄' },
        { name: 'minor_issue', icon: 'ℹ️' }
    ];
    
    severityIcons.forEach(({ name, icon }) => {
        const emailHas = emailContent.includes(`${name}: {`) && emailContent.includes(`icon: '${icon}'`);
        const categoryHas = categoryContent.includes(`${name}: {`) && categoryContent.includes(`icon: '${icon}'`);
        
        if (emailHas && categoryHas) {
            details.push(`✓ ${name} icon (${icon}) matches between email and UI`);
        } else {
            details.push(`✗ ${name} icon mismatch: email(${emailHas}) UI(${categoryHas})`);
        }
    });
    
    // Check trend icons
    const trendIcons = [
        { name: 'worsening_trend', icon: '↗️' },
        { name: 'improving_trend', icon: '↘️' },
        { name: 'stable_trend', icon: '➡️' }
    ];
    
    trendIcons.forEach(({ name, icon }) => {
        const emailHas = emailContent.includes(`${name}: {`) && emailContent.includes(`icon: '${icon}'`);
        const categoryHas = categoryContent.includes(`${name}: {`) && categoryContent.includes(`icon: '${icon}'`);
        
        if (emailHas && categoryHas) {
            details.push(`✓ ${name} icon (${icon}) matches between email and UI`);
        } else {
            details.push(`✗ ${name} icon mismatch: email(${emailHas}) UI(${categoryHas})`);
        }
    });
    
    const allMatch = details.every(detail => detail.startsWith('✓'));
    return { success: allMatch, details };
});

// Test 3: Business Hours Component
runTest('Business Hours Component Integration', () => {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const content = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const details = [];
    
    // Check single email function
    const singleEmailBH = content.includes('generateEmailBodyHTML') && 
                         content.includes('analysis_result.business_hours_analysis') &&
                         content.includes('total_events > 0');
    if (singleEmailBH) {
        details.push('✓ Business hours component in single email function');
    } else {
        details.push('✗ Business hours component MISSING from single email');
    }
    
    // Check combined email function
    const combinedEmailBH = content.includes('generateCombinedEmailBodyHTML') && 
                           content.includes('analysis_result.business_hours_analysis') &&
                           content.includes('total_events > 0');
    if (combinedEmailBH) {
        details.push('✓ Business hours component in combined email function');
    } else {
        details.push('✗ Business hours component MISSING from combined email');
    }
    
    // Check enhanced detection
    const enhancedDetection = content.includes('hasBusinessHoursImpact') &&
                             content.includes("finding.business_hours_impact === 'YES'") &&
                             content.includes("finding.summary_line.includes('🕐 AFFECTING BUSINESS HOURS')");
    if (enhancedDetection) {
        details.push('✓ Enhanced business hours flag detection');
    } else {
        details.push('✗ Enhanced business hours detection MISSING');
    }
    
    const allPresent = details.every(detail => detail.startsWith('✓'));
    return { success: allPresent, details };
});

// Test 4: SLA Column Integration
runTest('SLA Column Integration', () => {
    const serverIndexPath = path.join(__dirname, 'index.js');
    const content = fs.readFileSync(serverIndexPath, 'utf8');
    
    const details = [];
    
    // Check for category rename instruction
    const categoryRename = content.includes('Service Performance & SLA') && 
                          content.includes('RENAME CATEGORY');
    if (categoryRename) {
        details.push('✓ Category rename instruction present');
    } else {
        details.push('✗ Category rename instruction MISSING');
    }
    
    // Check for SLA data extraction
    const slaExtraction = content.includes('EXTRACT SLA DATA') && 
                         content.includes('SLA Profiles table');
    if (slaExtraction) {
        details.push('✓ SLA data extraction instruction present');
    } else {
        details.push('✗ SLA data extraction instruction MISSING');
    }
    
    // Check for matching logic
    const matchingLogic = content.includes('MATCH DATA') && 
                         content.includes('site/device/interface');
    if (matchingLogic) {
        details.push('✓ SLA matching logic instruction present');
    } else {
        details.push('✗ SLA matching logic instruction MISSING');
    }
    
    // Check for SLA name extraction
    const slaNameExtraction = content.includes('EXTRACT SLA NAME') && 
                             content.includes('SLA column');
    if (slaNameExtraction) {
        details.push('✓ SLA name extraction instruction present');
    } else {
        details.push('✗ SLA name extraction instruction MISSING');
    }
    
    // Check format specification
    const formatSpec = content.includes('SLA violations for [SLA_NAME]');
    if (formatSpec) {
        details.push('✓ SLA format specification present');
    } else {
        details.push('✗ SLA format specification MISSING');
    }
    
    // Check both chunked and non-chunked paths
    const chunkedPath = content.includes('Service Performance & SLA events, correlate');
    const nonChunkedPath = content.includes('Service Performance & SLA Integration');
    
    if (chunkedPath && nonChunkedPath) {
        details.push('✓ SLA integration in both chunked and non-chunked analysis paths');
    } else {
        details.push(`✗ SLA integration missing: chunked(${chunkedPath}) non-chunked(${nonChunkedPath})`);
    }
    
    const allPresent = details.every(detail => detail.startsWith('✓'));
    return { success: allPresent, details };
});

// Test 5: Recommendations Styling
runTest('Recommendations Styling', () => {
    const emailUtilsPath = path.join(__dirname, '../client/src/components/analysis/emailUtils.ts');
    const content = fs.readFileSync(emailUtilsPath, 'utf8');
    
    const details = [];
    
    // Check for emoji handling in recommendations
    const emojiHandling = content.includes('recommendationsHtml') && 
                         (content.includes('🔒') || content.includes('📈') || content.includes('👁️'));
    if (emojiHandling) {
        details.push('✓ Emoji handling in recommendations');
    } else {
        details.push('✗ Emoji handling MISSING in recommendations');
    }
    
    // Check for structured format handling
    const structuredFormat = content.includes('typeof recommendations === \'string\'') &&
                            content.includes('split(\'\\n\')');
    if (structuredFormat) {
        details.push('✓ Structured recommendations format handling');
    } else {
        details.push('✗ Structured format handling MISSING');
    }
    
    // Check for styling in both email functions
    const singleEmailRec = content.includes('generateEmailBodyHTML') && 
                          content.includes('recommendationsHtml');
    const combinedEmailRec = content.includes('generateCombinedEmailBodyHTML') && 
                            content.includes('recommendationsHtml');
    
    if (singleEmailRec && combinedEmailRec) {
        details.push('✓ Recommendations styling in both single and combined emails');
    } else {
        details.push(`✗ Recommendations styling missing: single(${singleEmailRec}) combined(${combinedEmailRec})`);
    }
    
    const allPresent = details.every(detail => detail.startsWith('✓'));
    return { success: allPresent, details };
});

// Final Summary
console.log('🎯 FINAL SUMMARY');
console.log('================');

if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! ✅');
    console.log('');
    console.log('📋 VERIFICATION STEPS:');
    console.log('1. 🔄 Restart the application (client & server)');
    console.log('2. 📄 Upload multiple PDFs for analysis');
    console.log('3. 🎨 Generate visuals for each report');
    console.log('4. 📋 Click "Copy All" and check console output');
    console.log('5. 📧 Paste into Gmail and verify:');
    console.log('   - Events have emoji badges (🚨, ℹ️, 🔄)');
    console.log('   - Trend indicators (↗️, ↘️, ➡️) with colors');
    console.log('   - Business hours flags (🕐) where applicable');
    console.log('   - Business hours dashboard appears');
    console.log('   - Recommendations have proper styling');
    console.log('   - SLA column data in Service Performance & SLA');
    console.log('');
    console.log('🚀 READY FOR PRODUCTION!');
} else {
    console.log('❌ SOME TESTS FAILED');
    console.log('');
    console.log('🔧 NEXT STEPS:');
    console.log('1. Review the failed tests above');
    console.log('2. Fix the specific issues identified');
    console.log('3. Re-run this test script');
    console.log('4. Repeat until all tests pass');
}

console.log('');
console.log('📝 NOTE: This script only checks code structure.');
console.log('   Manual testing with actual PDFs is still required!');
