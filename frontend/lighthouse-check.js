/**
 * Lighthouse PWA Score Checker
 * This script runs Lighthouse against the Phoenix frontend to check PWA scores
 *
 * Usage:
 * npm run lighthouse
 */

// Add "type": "module" to package.json or rename this file to .mjs

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL = 'http://localhost:5000'; // Phoenix ORCH frontend runs on port 5000

async function runLighthouse() {
  console.log('🔥 Phoenix ORCH - PWA Score Checker 🔥');
  console.log('======================================');
  console.log(`Running Lighthouse on ${URL}...`);
  
  // Launch Chrome
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  // Run Lighthouse
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['pwa'],
    port: chrome.port
  };

  try {
    console.log('Analyzing PWA capabilities...');
    const runnerResult = await lighthouse(URL, options);
    
    // Process the results
    const reportJson = runnerResult.report;
    const report = JSON.parse(reportJson);
    
    // Extract PWA scores and audits
    const pwaScore = report.categories.pwa.score * 100;
    const pwaAudits = report.categories.pwa.auditRefs.map(ref => {
      const audit = report.audits[ref.id];
      return {
        id: ref.id,
        title: audit.title,
        score: audit.score,
        scoreDisplayMode: audit.scoreDisplayMode,
        displayValue: audit.displayValue
      };
    });
    
    // Save the full report
    const reportDir = path.join(__dirname, 'lighthouse-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportPath = path.join(reportDir, `pwa-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, reportJson);
    
    // Display the results
    console.log('\n📊 PWA SCORE RESULTS 📊');
    console.log('======================');
    console.log(`Overall PWA Score: ${pwaScore.toFixed(0)}%`);
    
    console.log('\nPWA Audit Results:');
    const passedAudits = pwaAudits.filter(a => a.score === 1 || a.scoreDisplayMode === 'notApplicable');
    const failedAudits = pwaAudits.filter(a => a.score !== 1 && a.scoreDisplayMode !== 'notApplicable');
    
    console.log(`\n✅ PASSED (${passedAudits.length}/${pwaAudits.length}):`);
    passedAudits.forEach(audit => {
      console.log(`  - ${audit.title}`);
    });
    
    if (failedAudits.length > 0) {
      console.log(`\n❌ FAILED (${failedAudits.length}/${pwaAudits.length}):`);
      failedAudits.forEach(audit => {
        console.log(`  - ${audit.title}`);
      });
      
      console.log('\n🔍 RECOMMENDATIONS:');
      failedAudits.forEach(audit => {
        console.log(`  - ${audit.title}: Fix this issue to improve PWA score`);
      });
    } else {
      console.log('\n🎉 CONGRATULATIONS! All PWA audits passed!');
    }
    
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Error running Lighthouse:', error);
  } finally {
    // Close Chrome
    await chrome.kill();
  }
}

// Run the check
runLighthouse();