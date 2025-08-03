const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runPerformanceAudit(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = { 
    logLevel: 'info', 
    output: 'json', 
    onlyCategories: ['performance'], 
    port: chrome.port 
  };

  const runnerResult = await lighthouse(url, options);
  
  const reportHtml = runnerResult.report;
  const performanceScore = runnerResult.lhr.categories.performance.score * 100;

  console.log(`Performance Score: ${performanceScore}`);

  // Thresholds
  const PERFORMANCE_THRESHOLD = 80;
  if (performanceScore < PERFORMANCE_THRESHOLD) {
    console.error(`Performance below threshold: ${performanceScore}`);
    process.exit(1);
  }

  await chrome.kill();
}

runPerformanceAudit('http://localhost:3000');