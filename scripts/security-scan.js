const { spawn } = require('child_process');
const axios = require('axios');

async function runSecurityScans() {
  // Dependency vulnerability scan
  const dependencyScan = spawn('npm', ['audit', '--json']);
  
  dependencyScan.stdout.on('data', (data) => {
    const vulnerabilities = JSON.parse(data);
    if (vulnerabilities.vulnerabilities.high > 0) {
      console.error('High-severity vulnerabilities detected!');
      process.exit(1);
    }
  });

  // OWASP ZAP baseline scan
  const zapScan = spawn('zap-baseline.py', [
    '-t', 'http://localhost:3000',
    '-J', 'zap-report.json'
  ]);

  zapScan.on('close', (code) => {
    if (code !== 0) {
      console.error('Security vulnerabilities detected in ZAP scan');
      process.exit(1);
    }
  });
}

runSecurityScans();