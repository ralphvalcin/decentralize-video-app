#!/usr/bin/env node

/**
 * TURN Server Configuration Test Script
 * Tests TURN server authentication and connectivity
 */

import { TURNCredentialService } from '../src/services/TURNCredentialService.js';
import { getSecureWebRTCConfig, validateTURNConfig, generateTURNCredentials } from '../src/utils/security.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class TURNConfigurationTester {
  constructor() {
    this.results = {
      environmentCheck: false,
      credentialGeneration: false,
      configValidation: false,
      serviceInitialization: false,
      webrtcConfigGeneration: false,
      errors: []
    };
  }

  async runAllTests() {
    console.log('🔧 TURN Server Configuration Test Suite');
    console.log('=====================================\n');

    try {
      await this.testEnvironmentConfiguration();
      await this.testCredentialGeneration();
      await this.testTURNService();
      await this.testWebRTCConfiguration();
      await this.testConfigValidation();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testEnvironmentConfiguration() {
    console.log('1️⃣ Testing Environment Configuration...');
    
    const requiredEnvVars = ['NODE_ENV', 'JWT_SECRET'];
    const optionalEnvVars = ['TURN_SERVER_URL', 'TURN_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
    
    let hasRequiredVars = true;
    let hasTurnConfig = false;

    // Check required variables
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.results.errors.push(`Missing required environment variable: ${envVar}`);
        hasRequiredVars = false;
      }
    }

    // Check TURN configuration
    if (process.env.TURN_SERVER_URL && process.env.TURN_SECRET) {
      hasTurnConfig = true;
      console.log('   ✅ Self-hosted TURN server configured');
    }

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      hasTurnConfig = true;
      console.log('   ✅ Twilio TURN configuration found');
    }

    if (!hasTurnConfig) {
      console.log('   ⚠️  No TURN servers configured (will use STUN only)');
      console.log('   💡 Add TURN_SERVER_URL and TURN_SECRET for production use');
    }

    this.results.environmentCheck = hasRequiredVars;
    
    if (hasRequiredVars) {
      console.log('   ✅ Environment configuration valid\n');
    } else {
      console.log('   ❌ Environment configuration invalid\n');
    }
  }

  async testCredentialGeneration() {
    console.log('2️⃣ Testing TURN Credential Generation...');

    try {
      // Test with a known secret
      const testSecret = 'test-secret-key-for-turn-server';
      const credentials = generateTURNCredentials(testSecret, 3600);

      if (!credentials.username || !credentials.password) {
        throw new Error('Generated credentials missing username or password');
      }

      // Validate credential format
      const usernameRegex = /^\d+$/;
      if (!usernameRegex.test(credentials.username)) {
        throw new Error('Username should be a timestamp');
      }

      // Check if password is base64
      try {
        Buffer.from(credentials.password, 'base64');
      } catch {
        throw new Error('Password should be base64 encoded');
      }

      console.log('   ✅ Credential generation successful');
      console.log(`   📝 Sample username: ${credentials.username}`);
      console.log(`   📝 Sample password: ${credentials.password.substring(0, 10)}...`);
      
      this.results.credentialGeneration = true;
      console.log('');
    } catch (error) {
      this.results.errors.push(`Credential generation failed: ${error.message}`);
      console.log('   ❌ Credential generation failed:', error.message, '\n');
    }
  }

  async testTURNService() {
    console.log('3️⃣ Testing TURN Credential Service...');

    try {
      const turnService = new TURNCredentialService({
        twilio: process.env.TWILIO_ACCOUNT_SID ? {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN
        } : null
      });

      const turnConfig = await turnService.getTURNCredentials('test-user');
      
      if (!turnConfig) {
        throw new Error('TURN service returned null configuration');
      }

      if (!Array.isArray(turnConfig.servers)) {
        throw new Error('TURN configuration missing servers array');
      }

      console.log(`   ✅ TURN service initialized with ${turnConfig.servers.length} server(s)`);
      
      // Test each server configuration
      for (const [index, server] of turnConfig.servers.entries()) {
        if (!server.urls || !server.username || !server.credential) {
          throw new Error(`Server ${index} missing required fields`);
        }
        console.log(`   📡 Server ${index + 1}: ${Array.isArray(server.urls) ? server.urls[0] : server.urls}`);
      }

      // Test service statistics
      const stats = turnService.getStats();
      console.log(`   📊 Service stats: ${stats.configuredServers} configured servers, ${stats.cachedCredentials} cached`);

      this.results.serviceInitialization = true;
      console.log('');
    } catch (error) {
      this.results.errors.push(`TURN service test failed: ${error.message}`);
      console.log('   ❌ TURN service test failed:', error.message, '\n');
    }
  }

  async testWebRTCConfiguration() {
    console.log('4️⃣ Testing WebRTC Configuration Generation...');

    try {
      // Test with mock TURN config
      const mockTurnConfig = {
        servers: [{
          urls: ['turn:test-server.com:3478'],
          username: '123456789',
          credential: 'test-password',
          credentialType: 'password'
        }]
      };

      const webrtcConfig = getSecureWebRTCConfig(mockTurnConfig);

      if (!webrtcConfig.iceServers || !Array.isArray(webrtcConfig.iceServers)) {
        throw new Error('WebRTC config missing iceServers array');
      }

      const stunServers = webrtcConfig.iceServers.filter(s => 
        (Array.isArray(s.urls) ? s.urls.some(url => url.includes('stun:')) : s.urls.includes('stun:'))
      );
      
      const turnServers = webrtcConfig.iceServers.filter(s => 
        (Array.isArray(s.urls) ? s.urls.some(url => url.includes('turn:')) : s.urls.includes('turn:'))
      );

      console.log(`   ✅ WebRTC configuration generated`);
      console.log(`   🌐 STUN servers: ${stunServers.length}`);
      console.log(`   🔄 TURN servers: ${turnServers.length}`);
      console.log(`   🔧 Bundle policy: ${webrtcConfig.bundlePolicy}`);
      console.log(`   🔧 RTCP mux policy: ${webrtcConfig.rtcpMuxPolicy}`);

      this.results.webrtcConfigGeneration = true;
      console.log('');
    } catch (error) {
      this.results.errors.push(`WebRTC config generation failed: ${error.message}`);
      console.log('   ❌ WebRTC config generation failed:', error.message, '\n');
    }
  }

  async testConfigValidation() {
    console.log('5️⃣ Testing Configuration Validation...');

    try {
      // Test valid configuration
      const validConfig = {
        servers: [{
          urls: ['turn:valid-server.com:3478', 'turns:valid-server.com:5349'],
          username: '123456789',
          credential: 'valid-password'
        }]
      };

      const validResult = validateTURNConfig(validConfig);
      if (!validResult.isValid) {
        throw new Error(`Valid config rejected: ${validResult.error}`);
      }

      // Test invalid configurations
      const invalidConfigs = [
        { servers: [] }, // No servers
        { servers: [{ urls: ['turn:test.com:3478'] }] }, // Missing credentials
        { servers: [{ urls: ['invalid-url'], username: 'test', credential: 'test' }] }, // Invalid URL
        { notServers: [] } // Wrong structure
      ];

      for (const [index, config] of invalidConfigs.entries()) {
        const result = validateTURNConfig(config);
        if (result.isValid) {
          throw new Error(`Invalid config ${index} was incorrectly validated as valid`);
        }
      }

      console.log('   ✅ Configuration validation working correctly');
      console.log('   ✅ Valid configurations accepted');
      console.log('   ✅ Invalid configurations rejected');

      this.results.configValidation = true;
      console.log('');
    } catch (error) {
      this.results.errors.push(`Config validation test failed: ${error.message}`);
      console.log('   ❌ Config validation test failed:', error.message, '\n');
    }
  }

  printResults() {
    console.log('📋 Test Results Summary');
    console.log('=======================');
    
    const tests = [
      { name: 'Environment Configuration', passed: this.results.environmentCheck },
      { name: 'Credential Generation', passed: this.results.credentialGeneration },
      { name: 'TURN Service Initialization', passed: this.results.serviceInitialization },
      { name: 'WebRTC Config Generation', passed: this.results.webrtcConfigGeneration },
      { name: 'Configuration Validation', passed: this.results.configValidation }
    ];

    const passedTests = tests.filter(t => t.passed).length;
    const totalTests = tests.length;

    for (const test of tests) {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    }

    console.log(`\n🎯 Results: ${passedTests}/${totalTests} tests passed`);

    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors encountered:');
      for (const error of this.results.errors) {
        console.log(`   • ${error}`);
      }
    }

    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! TURN configuration is ready for production.');
      
      if (process.env.TURN_SERVER_URL && process.env.TURN_SECRET) {
        console.log('\n📚 Next steps for production deployment:');
        console.log('   1. Ensure your TURN server is running and accessible');
        console.log('   2. Test connectivity from your target deployment environment');
        console.log('   3. Monitor TURN server logs for authentication requests');
        console.log('   4. Set up monitoring for TURN server availability');
      } else {
        console.log('\n⚠️  Note: No TURN servers configured. For production use:');
        console.log('   1. Set TURN_SERVER_URL and TURN_SECRET environment variables');
        console.log('   2. Or configure Twilio TURN servers with TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
        console.log('   3. STUN-only configuration may fail in restrictive network environments');
      }
    } else {
      console.log('\n❌ Some tests failed. Please check the errors above and fix configuration issues.');
      process.exit(1);
    }
  }
}

// Run the test suite
async function main() {
  const tester = new TURNConfigurationTester();
  await tester.runAllTests();
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export default TURNConfigurationTester;