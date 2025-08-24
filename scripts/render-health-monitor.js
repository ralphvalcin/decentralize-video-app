#!/usr/bin/env node

/**
 * Render Backend Health Monitor
 * Created during incident response to provide comprehensive health monitoring
 * for the signaling server deployed on Render platform.
 */

import { io } from 'socket.io-client';
import https from 'https';
import { performance } from 'perf_hooks';

const BACKEND_URL = 'https://decentralize-video-app-2.onrender.com';
const WEBSOCKET_URL = 'wss://decentralize-video-app-2.onrender.com';

class HealthMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallStatus: 'UNKNOWN',
      checks: {}
    };
  }

  async checkHttpEndpoint(path, expectedStatus = 200) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const url = `${BACKEND_URL}${path}`;
      
      https.get(url, (res) => {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          let parsedData = null;
          if (data) {
            try {
              parsedData = JSON.parse(data);
            } catch {
              parsedData = data; // Keep as string if not JSON
            }
          }
          resolve({
            success: res.statusCode === expectedStatus,
            statusCode: res.statusCode,
            responseTime: responseTime,
            data: parsedData,
            error: null
          });
        });
      }).on('error', (err) => {
        const endTime = performance.now();
        resolve({
          success: false,
          statusCode: null,
          responseTime: Math.round(endTime - startTime),
          data: null,
          error: err.message
        });
      });
    });
  }

  async checkWebSocketConnection() {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let connectionEstablished = false;
      let tokenReceived = false;
      
      const socket = io(WEBSOCKET_URL, {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      const cleanup = () => {
        socket.disconnect();
        const endTime = performance.now();
        resolve({
          success: connectionEstablished && tokenReceived,
          responseTime: Math.round(endTime - startTime),
          connectionEstablished,
          tokenReceived,
          transport: socket.io?.engine?.transport?.name || null,
          error: null
        });
      };

      socket.on('connect', () => {
        connectionEstablished = true;
        
        // Test token generation functionality
        socket.emit('request-room-token', {
          roomId: 'health-check-room',
          userName: 'HealthMonitor'
        });
      });

      socket.on('room-token', () => {
        tokenReceived = true;
        setTimeout(cleanup, 100); // Small delay to ensure everything is captured
      });

      socket.on('connect_error', (error) => {
        const endTime = performance.now();
        resolve({
          success: false,
          responseTime: Math.round(endTime - startTime),
          connectionEstablished: false,
          tokenReceived: false,
          transport: null,
          error: error.message
        });
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!tokenReceived) {
          cleanup();
        }
      }, 15000);
    });
  }

  async runHealthChecks() {
    console.log(`🏥 Starting health monitoring at ${this.results.timestamp}`);
    console.log(`📍 Backend URL: ${BACKEND_URL}`);
    console.log(`🔌 WebSocket URL: ${WEBSOCKET_URL}\n`);

    // Check health endpoint
    console.log('1️⃣ Checking /health endpoint...');
    this.results.checks.health = await this.checkHttpEndpoint('/health');
    this.logCheckResult('Health Endpoint', this.results.checks.health);

    // Check metrics endpoint
    console.log('\n2️⃣ Checking /metrics endpoint...');
    this.results.checks.metrics = await this.checkHttpEndpoint('/metrics');
    this.logCheckResult('Metrics Endpoint', this.results.checks.metrics);

    // Check status endpoint
    console.log('\n3️⃣ Checking /status endpoint...');
    this.results.checks.status = await this.checkHttpEndpoint('/status');
    this.logCheckResult('Status Endpoint', this.results.checks.status);

    // Check root endpoint (should return 404 with proper error message)
    console.log('\n4️⃣ Checking root endpoint (expect 404)...');
    this.results.checks.root = await this.checkHttpEndpoint('/', 404);
    this.logCheckResult('Root Endpoint (404 expected)', this.results.checks.root);

    // Check WebSocket connection
    console.log('\n5️⃣ Testing WebSocket connection...');
    this.results.checks.websocket = await this.checkWebSocketConnection();
    this.logWebSocketResult(this.results.checks.websocket);

    this.calculateOverallStatus();
    this.generateSummary();
  }

  logCheckResult(name, result) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    
    console.log(`   ${status} - ${responseTime}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error || `Unexpected status code ${result.statusCode}`}`);
    } else if (result.data) {
      console.log(`   Response: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
    }
  }

  logWebSocketResult(result) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    
    console.log(`   ${status} - ${responseTime}`);
    console.log(`   Connection: ${result.connectionEstablished ? '✅' : '❌'}`);
    console.log(`   Token Generation: ${result.tokenReceived ? '✅' : '❌'}`);
    console.log(`   Transport: ${result.transport || 'N/A'}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  calculateOverallStatus() {
    const criticalChecks = ['health', 'websocket'];
    const allCriticalPassed = criticalChecks.every(check => 
      this.results.checks[check]?.success
    );
    
    const allChecksPassed = Object.values(this.results.checks)
      .every(check => check.success);
    
    if (allCriticalPassed && allChecksPassed) {
      this.results.overallStatus = 'HEALTHY';
    } else if (allCriticalPassed) {
      this.results.overallStatus = 'DEGRADED';
    } else {
      this.results.overallStatus = 'UNHEALTHY';
    }
  }

  generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🏥 HEALTH CHECK SUMMARY');
    console.log('='.repeat(60));
    
    const statusEmoji = {
      'HEALTHY': '✅',
      'DEGRADED': '⚠️',
      'UNHEALTHY': '❌'
    };
    
    console.log(`Overall Status: ${statusEmoji[this.results.overallStatus]} ${this.results.overallStatus}`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    
    console.log('\nEndpoint Status:');
    Object.entries(this.results.checks).forEach(([name, result]) => {
      const emoji = result.success ? '✅' : '❌';
      const time = result.responseTime ? ` (${result.responseTime}ms)` : '';
      console.log(`  ${emoji} ${name}${time}`);
    });
    
    if (this.results.overallStatus === 'HEALTHY') {
      console.log('\n🎉 All systems operational!');
      console.log('The signaling server is healthy and ready to handle connections.');
    } else if (this.results.overallStatus === 'DEGRADED') {
      console.log('\n⚠️  Core functionality available with some issues.');
      console.log('Monitor closely and investigate non-critical failures.');
    } else {
      console.log('\n🚨 Critical issues detected!');
      console.log('Immediate attention required - service may be impaired.');
    }
    
    console.log('\nFor detailed metrics, visit:');
    console.log(`📊 ${BACKEND_URL}/health`);
    console.log(`📈 ${BACKEND_URL}/metrics`);
    
    // Exit with appropriate code
    process.exit(this.results.overallStatus === 'UNHEALTHY' ? 1 : 0);
  }
}

// Run health checks if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new HealthMonitor();
  monitor.runHealthChecks().catch(error => {
    console.error('Health monitor failed:', error);
    process.exit(1);
  });
}

export default HealthMonitor;