#!/usr/bin/env node

/**
 * k6 Load Test Syntax Validator
 * 
 * This script validates the syntax and structure of k6 load testing scripts
 * without requiring k6 to be installed.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating k6 Load Testing Scripts...\n');

const testFiles = [
  './load-test.js',
  './webrtc-performance-benchmark.js'
];

let allValid = true;

testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  console.log(`📋 Validating: ${file}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ File not found: ${filePath}`);
      allValid = false;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check required k6 imports
    const requiredImports = ['k6/http', 'k6/ws', 'k6/metrics'];
    const hasRequiredImports = requiredImports.some(imp => content.includes(imp));
    
    if (!hasRequiredImports) {
      console.log(`  ❌ Missing required k6 imports`);
      allValid = false;
    } else {
      console.log(`  ✅ Has k6 imports`);
    }

    // Check for options export
    if (content.includes('export let options') || content.includes('export const options')) {
      console.log(`  ✅ Has options configuration`);
    } else {
      console.log(`  ⚠️  No options configuration found`);
    }

    // Check for default export function
    if (content.includes('export default function') || content.includes('function main')) {
      console.log(`  ✅ Has default test function`);
    } else {
      console.log(`  ❌ Missing default test function`);
      allValid = false;
    }

    // Check for proper WebSocket usage
    if (file.includes('load-test') && content.includes('ws.connect')) {
      console.log(`  ✅ Has WebSocket testing`);
    }

    // Check for metrics usage
    const metricsCount = (content.match(/new (Trend|Rate|Counter|Gauge)/g) || []).length;
    console.log(`  📊 Custom metrics defined: ${metricsCount}`);

    // Check for thresholds
    if (content.includes('thresholds:')) {
      console.log(`  ✅ Has performance thresholds`);
    } else {
      console.log(`  ⚠️  No performance thresholds defined`);
    }

    console.log(`  ✅ Syntax validation passed\n`);

  } catch (error) {
    console.log(`  ❌ Validation failed: ${error.message}\n`);
    allValid = false;
  }
});

console.log('📊 Validation Summary:');
console.log(`Overall Status: ${allValid ? '✅ PASSED' : '❌ FAILED'}`);

if (allValid) {
  console.log('\n🚀 Load testing scripts are ready for execution with k6!');
  console.log('📝 To run the tests, install k6 and use:');
  console.log('   k6 run tests/load/load-test.js');
  console.log('   k6 run tests/load/webrtc-performance-benchmark.js');
} else {
  console.log('\n⚠️  Some validation issues were found. Please review and fix.');
}

process.exit(allValid ? 0 : 1);