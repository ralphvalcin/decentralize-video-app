#!/usr/bin/env node

/**
 * WebRTC Connection Testing Tool
 * Automated testing for WebRTC connectivity and performance
 * Supports STUN/TURN server validation and peer connection diagnostics
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const WebSocket = require('ws');
const fetch = require('node-fetch');

class WebRTCConnectionTester {
  constructor() {
    this.signalingServerUrl = process.env.SIGNALING_SERVER_URL || 'ws://localhost:5001';
    this.stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ];
    this.results = {
      signaling: { status: 'unknown', latency: 0 },
      stun: { status: 'unknown', servers: [] },
      connectivity: { status: 'unknown', details: {} }
    };
  }

  async testSignalingServer() {
    console.log('🔗 Testing signaling server connection...');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const ws = new WebSocket(this.signalingServerUrl);
      
      ws.on('open', () => {
        const latency = Date.now() - startTime;
        console.log(`✅ Signaling server connected (${latency}ms)`);
        
        this.results.signaling = {
          status: 'connected',
          latency,
          url: this.signalingServerUrl
        };
        
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (error) => {
        console.log(`❌ Signaling server connection failed: ${error.message}`);
        this.results.signaling = {
          status: 'failed',
          error: error.message
        };
        resolve(false);
      });
      
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          console.log('❌ Signaling server connection timeout');
          this.results.signaling = {
            status: 'timeout',
            error: 'Connection timeout after 5 seconds'
          };
          resolve(false);
        }
      }, 5000);
    });
  }

  async testSTUNServers() {
    console.log('🌐 Testing STUN servers...');
    
    const stunResults = [];
    
    for (const stunServer of this.stunServers) {
      try {
        console.log(`  Testing: ${stunServer}`);
        
        // Create RTCPeerConnection with STUN server
        const RTCPeerConnection = require('wrtc').RTCPeerConnection;
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: stunServer }]
        });
        
        const result = await this.testPeerConnection(pc, stunServer);
        stunResults.push(result);
        
        pc.close();
      } catch (error) {
        console.log(`  ❌ ${stunServer}: ${error.message}`);
        stunResults.push({
          server: stunServer,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    this.results.stun = {
      status: stunResults.some(r => r.status === 'success') ? 'partial' : 'failed',
      servers: stunResults
    };
    
    const successCount = stunResults.filter(r => r.status === 'success').length;
    console.log(`✅ STUN servers: ${successCount}/${stunResults.length} working`);
  }

  async testPeerConnection(pc, serverName) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let resolved = false;
      
      pc.onicecandidate = (event) => {
        if (event.candidate && !resolved) {
          resolved = true;
          const latency = Date.now() - startTime;
          console.log(`  ✅ ${serverName}: ICE candidate received (${latency}ms)`);
          resolve({
            server: serverName,
            status: 'success',
            latency,
            candidateType: event.candidate.type
          });
        }
      };
      
      pc.onicecandidateerror = (event) => {
        if (!resolved) {
          resolved = true;
          console.log(`  ❌ ${serverName}: ICE error - ${event.errorText}`);
          resolve({
            server: serverName,
            status: 'failed',
            error: event.errorText
          });
        }
      };
      
      // Create data channel to trigger ICE gathering
      pc.createDataChannel('test');
      
      // Create offer to start ICE gathering
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).catch(error => {
        if (!resolved) {
          resolved = true;
          resolve({
            server: serverName,
            status: 'failed',
            error: error.message
          });
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(`  ⏱️ ${serverName}: Timeout`);
          resolve({
            server: serverName,
            status: 'timeout',
            error: 'ICE gathering timeout'
          });
        }
      }, 10000);
    });
  }

  async testNetworkConnectivity() {
    console.log('🌍 Testing network connectivity...');
    
    const tests = [
      { name: 'Google DNS', host: '8.8.8.8', port: 53 },
      { name: 'Cloudflare DNS', host: '1.1.1.1', port: 53 },
      { name: 'GitHub', host: 'github.com', port: 443 }
    ];
    
    const connectivityResults = {};
    
    for (const test of tests) {
      try {
        const startTime = Date.now();
        const response = await fetch(`https://${test.host}`, {
          method: 'HEAD',
          timeout: 5000
        });
        const latency = Date.now() - startTime;
        
        connectivityResults[test.name] = {
          status: 'success',
          latency,
          statusCode: response.status
        };
        console.log(`  ✅ ${test.name}: ${latency}ms`);
      } catch (error) {
        connectivityResults[test.name] = {
          status: 'failed',
          error: error.message
        };
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
    
    this.results.connectivity = {
      status: Object.values(connectivityResults).some(r => r.status === 'success') ? 'partial' : 'failed',
      details: connectivityResults
    };
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        platform: process.platform,
        node: process.version,
        signalingServer: this.signalingServerUrl
      },
      results: this.results,
      recommendations: []
    };

    // Generate recommendations
    if (this.results.signaling.status === 'failed') {
      report.recommendations.push({
        type: 'critical',
        message: 'Signaling server not accessible. Start the backend server.',
        action: 'npm run start:signaling'
      });
    }

    if (this.results.stun.status === 'failed') {
      report.recommendations.push({
        type: 'warning',
        message: 'STUN servers not accessible. WebRTC connections may fail behind NAT.',
        action: 'Check firewall settings and network configuration'
      });
    }

    if (this.results.signaling.latency > 100) {
      report.recommendations.push({
        type: 'info',
        message: 'High latency to signaling server detected.',
        action: 'Consider using a local signaling server for development'
      });
    }

    console.log('\\n📊 Connection Test Report:');
    console.log('==========================');
    console.log(`Signaling: ${this.results.signaling.status}`);
    console.log(`STUN: ${this.results.stun.status}`);
    console.log(`Connectivity: ${this.results.connectivity.status}`);
    
    if (report.recommendations.length > 0) {
      console.log('\\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.type.toUpperCase()}] ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
      });
    }

    return report;
  }

  async runFullTest() {
    console.log('🚀 Starting WebRTC Connection Test Suite\\n');
    
    try {
      await this.testSignalingServer();
      await this.testSTUNServers();
      await this.testNetworkConnectivity();
      
      const report = await this.generateReport();
      
      // Save report
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportFile = path.join(reportsDir, `webrtc-test-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
      
      console.log(`\\n📁 Detailed report saved to: ${reportFile}`);
      
      const overallStatus = [
        this.results.signaling.status,
        this.results.stun.status,
        this.results.connectivity.status
      ].every(status => status === 'success' || status === 'partial') ? 'PASS' : 'FAIL';
      
      console.log(`\\n🎯 Overall Result: ${overallStatus}`);
      
      return overallStatus === 'PASS';
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      return false;
    }
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new WebRTCConnectionTester();
  tester.runFullTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}