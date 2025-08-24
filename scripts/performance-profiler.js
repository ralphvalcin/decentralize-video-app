#!/usr/bin/env node

/**
 * Performance Profiler for Cross-Agent Development
 * Provides comprehensive performance analysis for WebRTC, AI, and UX components
 * Supports all enhancement phases with detailed metrics collection
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class PerformanceProfiler {
  constructor() {
    this.metrics = {
      webrtc: {
        connectionTime: 0,
        videoQuality: 0,
        audioLatency: 0,
        peerConnections: 0
      },
      frontend: {
        bundleSize: 0,
        loadTime: 0,
        renderTime: 0,
        memoryUsage: 0
      },
      backend: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        concurrentConnections: 0
      },
      build: {
        buildTime: 0,
        testTime: 0,
        lintTime: 0
      }
    };
    
    this.thresholds = {
      webrtc: {
        connectionTime: 3000, // ms
        audioLatency: 100,    // ms
        videoQuality: 720     // p
      },
      frontend: {
        bundleSize: 5000,     // KB
        loadTime: 2000,       // ms
        renderTime: 100       // ms
      },
      backend: {
        responseTime: 200,    // ms
        throughput: 1000,     // req/s
        errorRate: 0.01       // 1%
      },
      build: {
        buildTime: 60,        // seconds
        testTime: 30,         // seconds
        lintTime: 10          // seconds
      }
    };
  }

  async profileWebRTC() {
    console.log('📹 Profiling WebRTC performance...');
    
    try {
      // Run WebRTC connection test
      const startTime = Date.now();
      const result = await this.runCommand('npm', ['run', 'webrtc:test:connection']);
      const endTime = Date.now();
      
      this.metrics.webrtc.connectionTime = endTime - startTime;
      
      // Parse connection test results
      if (result.stdout) {
        const connectionMatch = result.stdout.match(/connected.*\((\d+)ms\)/);
        if (connectionMatch) {
          this.metrics.webrtc.connectionTime = parseInt(connectionMatch[1]);
        }
      }
      
      console.log(`  Connection Time: ${this.metrics.webrtc.connectionTime}ms`);
      
      return this.metrics.webrtc.connectionTime <= this.thresholds.webrtc.connectionTime;
    } catch (error) {
      console.log(`  ❌ WebRTC profiling failed: ${error.message}`);
      return false;
    }
  }

  async profileFrontend() {
    console.log('🎨 Profiling frontend performance...');
    
    try {
      // Build the application and measure bundle size
      console.log('  Building application...');
      const buildStart = Date.now();
      await this.runCommand('npm', ['run', 'build']);
      const buildTime = Date.now() - buildStart;
      
      this.metrics.build.buildTime = Math.round(buildTime / 1000);
      
      // Analyze bundle size
      const distPath = path.join(process.cwd(), 'dist');
      const bundleStats = await this.analyzeBundleSize(distPath);
      this.metrics.frontend.bundleSize = bundleStats.totalSize;
      
      console.log(`  Build Time: ${this.metrics.build.buildTime}s`);
      console.log(`  Bundle Size: ${Math.round(this.metrics.frontend.bundleSize / 1024)}KB`);
      
      // Check if we're within thresholds
      const buildOk = this.metrics.build.buildTime <= this.thresholds.build.buildTime;
      const bundleOk = this.metrics.frontend.bundleSize <= this.thresholds.frontend.bundleSize * 1024;
      
      return buildOk && bundleOk;
    } catch (error) {
      console.log(`  ❌ Frontend profiling failed: ${error.message}`);
      return false;
    }
  }

  async profileBackend() {
    console.log('⚡ Profiling backend performance...');
    
    try {
      // Check if signaling server is running
      const serverRunning = await this.checkServerHealth();
      
      if (serverRunning) {
        // Run basic performance test
        const responseTime = await this.measureResponseTime();
        this.metrics.backend.responseTime = responseTime;
        
        console.log(`  Response Time: ${responseTime}ms`);
        return responseTime <= this.thresholds.backend.responseTime;
      } else {
        console.log('  ⚠️ Signaling server not running - starting temporarily...');
        
        // Start server for testing
        const serverProcess = spawn('node', ['signaling-server.js'], {
          stdio: 'pipe',
          env: { ...process.env, NODE_ENV: 'test' }
        });
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const responseTime = await this.measureResponseTime();
        this.metrics.backend.responseTime = responseTime;
        
        // Clean up
        serverProcess.kill();
        
        console.log(`  Response Time: ${responseTime}ms`);
        return responseTime <= this.thresholds.backend.responseTime;
      }
    } catch (error) {
      console.log(`  ❌ Backend profiling failed: ${error.message}`);
      return false;
    }
  }

  async profileTesting() {
    console.log('🧪 Profiling test performance...');
    
    try {
      // Run unit tests and measure time
      console.log('  Running unit tests...');
      const testStart = Date.now();
      const testResult = await this.runCommand('npm', ['run', 'test:unit', '--', '--passWithNoTests']);
      const testTime = Date.now() - testStart;
      
      this.metrics.build.testTime = Math.round(testTime / 1000);
      
      // Run linting and measure time
      console.log('  Running linter...');
      const lintStart = Date.now();
      await this.runCommand('npm', ['run', 'lint']);
      const lintTime = Date.now() - lintStart;
      
      this.metrics.build.lintTime = Math.round(lintTime / 1000);
      
      console.log(`  Test Time: ${this.metrics.build.testTime}s`);
      console.log(`  Lint Time: ${this.metrics.build.lintTime}s`);
      
      const testOk = this.metrics.build.testTime <= this.thresholds.build.testTime;
      const lintOk = this.metrics.build.lintTime <= this.thresholds.build.lintTime;
      
      return testOk && lintOk;
    } catch (error) {
      console.log(`  ❌ Testing profiling failed: ${error.message}`);
      return false;
    }
  }

  async analyzeBundleSize(distPath) {
    try {
      const stats = { totalSize: 0, files: [] };
      const files = await fs.readdir(distPath, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(distPath, file);
        const fileStat = await fs.stat(filePath);
        
        if (fileStat.isFile()) {
          stats.totalSize += fileStat.size;
          stats.files.push({
            name: file,
            size: fileStat.size
          });
        }
      }
      
      return stats;
    } catch (error) {
      return { totalSize: 0, files: [] };
    }
  }

  async checkServerHealth() {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(5001, 'localhost');
    });
  }

  async measureResponseTime() {
    try {
      const fetch = (await import('node-fetch')).default;
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:5001/health', {
        method: 'GET',
        timeout: 5000
      });
      
      const endTime = Date.now();
      
      if (response.ok) {
        return endTime - startTime;
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      // Fallback to basic socket connection test
      return new Promise((resolve) => {
        const startTime = Date.now();
        const net = require('net');
        const socket = new net.Socket();
        
        socket.on('connect', () => {
          const responseTime = Date.now() - startTime;
          socket.destroy();
          resolve(responseTime);
        });
        
        socket.on('error', () => {
          resolve(1000); // Return 1s if connection fails
        });
        
        socket.connect(5001, 'localhost');
      });
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      thresholds: this.thresholds,
      analysis: {
        overallScore: 0,
        bottlenecks: [],
        recommendations: []
      }
    };

    // Calculate performance scores
    const scores = {
      webrtc: this.metrics.webrtc.connectionTime <= this.thresholds.webrtc.connectionTime ? 100 : 
              Math.max(0, 100 - ((this.metrics.webrtc.connectionTime - this.thresholds.webrtc.connectionTime) / 100)),
      frontend: this.metrics.frontend.bundleSize <= this.thresholds.frontend.bundleSize * 1024 ? 100 :
                Math.max(0, 100 - ((this.metrics.frontend.bundleSize - this.thresholds.frontend.bundleSize * 1024) / 1000)),
      backend: this.metrics.backend.responseTime <= this.thresholds.backend.responseTime ? 100 :
               Math.max(0, 100 - ((this.metrics.backend.responseTime - this.thresholds.backend.responseTime) / 10)),
      build: Math.min(
        this.metrics.build.buildTime <= this.thresholds.build.buildTime ? 100 : 
          Math.max(0, 100 - ((this.metrics.build.buildTime - this.thresholds.build.buildTime) / 5)),
        this.metrics.build.testTime <= this.thresholds.build.testTime ? 100 :
          Math.max(0, 100 - ((this.metrics.build.testTime - this.thresholds.build.testTime) / 3))
      )
    };

    report.analysis.overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b) / Object.keys(scores).length);

    // Identify bottlenecks
    Object.entries(scores).forEach(([category, score]) => {
      if (score < 80) {
        report.analysis.bottlenecks.push({
          category,
          score: Math.round(score),
          severity: score < 50 ? 'high' : score < 80 ? 'medium' : 'low'
        });
      }
    });

    // Generate recommendations
    if (this.metrics.webrtc.connectionTime > this.thresholds.webrtc.connectionTime) {
      report.analysis.recommendations.push({
        category: 'WebRTC',
        issue: 'Slow peer connection establishment',
        action: 'Optimize STUN/TURN server configuration and ICE gathering'
      });
    }

    if (this.metrics.frontend.bundleSize > this.thresholds.frontend.bundleSize * 1024) {
      report.analysis.recommendations.push({
        category: 'Frontend',
        issue: 'Large bundle size affecting load times',
        action: 'Implement code splitting and optimize dependencies'
      });
    }

    if (this.metrics.backend.responseTime > this.thresholds.backend.responseTime) {
      report.analysis.recommendations.push({
        category: 'Backend',
        issue: 'High server response times',
        action: 'Optimize signaling server performance and database queries'
      });
    }

    if (this.metrics.build.buildTime > this.thresholds.build.buildTime) {
      report.analysis.recommendations.push({
        category: 'Build',
        issue: 'Slow build times affecting developer productivity',
        action: 'Optimize build configuration and enable incremental builds'
      });
    }

    return report;
  }

  async runFullProfile() {
    console.log('🚀 Starting Comprehensive Performance Profile\n');
    
    try {
      const results = {
        webrtc: await this.profileWebRTC(),
        frontend: await this.profileFrontend(), 
        backend: await this.profileBackend(),
        testing: await this.profileTesting()
      };
      
      console.log('');
      
      const report = this.generatePerformanceReport();

      // Save report
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportFile = path.join(reportsDir, `performance-profile-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      console.log('📊 Performance Profile Report:');
      console.log('==============================');
      console.log(`Overall Score: ${report.analysis.overallScore}/100`);
      console.log(`WebRTC Connection: ${this.metrics.webrtc.connectionTime}ms`);
      console.log(`Bundle Size: ${Math.round(this.metrics.frontend.bundleSize / 1024)}KB`);
      console.log(`Server Response: ${this.metrics.backend.responseTime}ms`);
      console.log(`Build Time: ${this.metrics.build.buildTime}s`);
      console.log(`Test Time: ${this.metrics.build.testTime}s`);
      
      if (report.analysis.bottlenecks.length > 0) {
        console.log('\n⚠️ Performance Bottlenecks:');
        report.analysis.bottlenecks.forEach(bottleneck => {
          console.log(`  ${bottleneck.category}: ${bottleneck.score}/100 (${bottleneck.severity})`);
        });
      }

      if (report.analysis.recommendations.length > 0) {
        console.log('\n💡 Optimization Recommendations:');
        report.analysis.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.category}] ${rec.issue}`);
          console.log(`   Action: ${rec.action}`);
        });
      }

      console.log(`\n📁 Detailed report saved to: ${reportFile}`);
      
      return report.analysis.overallScore >= 80;
    } catch (error) {
      console.error('❌ Performance profiling failed:', error.message);
      return false;
    }
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const profiler = new PerformanceProfiler();
  profiler.runFullProfile().then(success => {
    process.exit(success ? 0 : 1);
  });
}