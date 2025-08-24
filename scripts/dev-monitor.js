#!/usr/bin/env node

/**
 * Development Environment Monitor
 * Real-time monitoring for local development environment
 * Tracks WebRTC connections, performance metrics, and team collaboration status
 */

import { spawn } from 'child_process';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs/promises';
import path from 'path';

class DevelopmentMonitor {
  constructor() {
    this.metrics = {
      webrtc: {
        connections: 0,
        quality: 'unknown',
        lastCheck: null
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        buildTime: 0
      },
      testing: {
        lastRun: null,
        status: 'unknown',
        coverage: 0
      },
      team: {
        activeAgents: [],
        lastSync: null
      }
    };
    
    this.server = createServer();
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('📊 Development monitor client connected');
      
      // Send current metrics to new client
      socket.emit('metrics-update', this.metrics);
      
      socket.on('webrtc-status', (data) => {
        this.metrics.webrtc = { ...this.metrics.webrtc, ...data };
        this.broadcastMetrics();
      });
      
      socket.on('performance-update', (data) => {
        this.metrics.performance = { ...this.metrics.performance, ...data };
        this.broadcastMetrics();
      });
      
      socket.on('disconnect', () => {
        console.log('📊 Development monitor client disconnected');
      });
    });
  }

  broadcastMetrics() {
    this.io.emit('metrics-update', this.metrics);
  }

  async collectSystemMetrics() {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.metrics.performance.memoryUsage = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      // Check if frontend and backend are running
      const frontendRunning = await this.checkPort(5173);
      const backendRunning = await this.checkPort(5001);
      
      console.log(`🔍 System Status:`);
      console.log(`  Frontend (5173): ${frontendRunning ? '✅ Running' : '❌ Stopped'}`);
      console.log(`  Backend (5001): ${backendRunning ? '✅ Running' : '❌ Stopped'}`);
      console.log(`  Memory Usage: ${this.metrics.performance.memoryUsage}MB`);
      
      // Check test status
      await this.checkTestStatus();
      
      this.broadcastMetrics();
    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message);
    }
  }

  async checkPort(port) {
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
      
      socket.connect(port, 'localhost');
    });
  }

  async checkTestStatus() {
    try {
      const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      const stats = await fs.stat(coverageFile);
      
      if (stats) {
        const coverage = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
        this.metrics.testing = {
          lastRun: stats.mtime,
          status: 'passed',
          coverage: Math.round(coverage.total?.statements?.pct || 0)
        };
      }
    } catch (error) {
      this.metrics.testing.status = 'unknown';
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      metrics: this.metrics,
      recommendations: []
    };

    // Generate recommendations based on metrics
    if (this.metrics.performance.memoryUsage > 500) {
      report.recommendations.push({
        type: 'performance',
        message: 'High memory usage detected. Consider restarting development servers.',
        action: 'npm run dx:reset'
      });
    }

    if (this.metrics.testing.coverage < 80) {
      report.recommendations.push({
        type: 'testing',
        message: 'Test coverage below 80%. Consider adding more tests.',
        action: 'npm run test:coverage'
      });
    }

    // Save report
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `dev-report-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📈 Development report saved to: ${reportFile}`);
    return report;
  }

  start() {
    const PORT = process.env.DEV_MONITOR_PORT || 3001;
    
    this.server.listen(PORT, () => {
      console.log(`📊 Development Monitor running on http://localhost:${PORT}`);
      console.log(`🔗 WebSocket endpoint: ws://localhost:${PORT}`);
      console.log('');
      console.log('📋 Available commands:');
      console.log('  - npm run dx:metrics (open dashboard)');
      console.log('  - npm run dx:dev (start with monitoring)');
      console.log('  - npm run webrtc:debug (debug WebRTC connections)');
      console.log('');
    });

    // Collect metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // Generate hourly reports
    setInterval(() => {
      this.generateReport();
    }, 60 * 60 * 1000);

    // Initial collection
    this.collectSystemMetrics();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\\n📊 Shutting down development monitor...');
      this.generateReport().then(() => {
        process.exit(0);
      });
    });
  }
}

// Start the monitor
const monitor = new DevelopmentMonitor();
monitor.start();