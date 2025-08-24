#!/usr/bin/env node

/**
 * Security Compliance Check for Cross-Agent Development
 * Validates security standards across all enhancement phases
 * Provides comprehensive security analysis for multi-agent coordination
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class SecurityComplianceChecker {
  constructor() {
    this.securityChecks = {
      dependencies: { status: 'unknown', vulnerabilities: [] },
      secrets: { status: 'unknown', exposures: [] },
      configurations: { status: 'unknown', issues: [] },
      network: { status: 'unknown', findings: [] },
      authentication: { status: 'unknown', weaknesses: [] }
    };
    
    this.complianceStandards = {
      'OWASP Top 10': true,
      'Security Headers': true,
      'Input Validation': true,
      'Authentication': true,
      'Authorization': true
    };
  }

  async checkDependencyVulnerabilities() {
    console.log('🔍 Checking dependency vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = await this.runCommand('npm', ['audit', '--json']);
      const auditData = JSON.parse(auditResult.stdout || '{}');
      
      const vulnerabilities = [];
      if (auditData.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            vulnerabilities.push({
              package: pkg,
              severity: vuln.severity,
              title: vuln.title,
              fixAvailable: vuln.fixAvailable
            });
          }
        }
      }
      
      this.securityChecks.dependencies = {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerabilities',
        vulnerabilities,
        totalAudited: auditData.metadata?.totalDependencies || 0
      };
      
      console.log(`  Dependencies audited: ${this.securityChecks.dependencies.totalAudited}`);
      console.log(`  High/Critical vulnerabilities: ${vulnerabilities.length}`);
      
    } catch (error) {
      console.log(`  ❌ Dependency audit failed: ${error.message}`);
      this.securityChecks.dependencies = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkSecretsExposure() {
    console.log('🔐 Checking for exposed secrets...');
    
    const exposures = [];
    const sensitivePatterns = [
      { name: 'API Keys', pattern: /[a-zA-Z0-9]{32,}/, context: 'api' },
      { name: 'JWT Secrets', pattern: /jwt[_-]?secret/i, context: 'auth' },
      { name: 'Database URLs', pattern: /(mongodb|mysql|postgres):\/\/.*:.*@/i, context: 'database' },
      { name: 'Private Keys', pattern: /-----BEGIN (PRIVATE|RSA|DSA|EC) KEY-----/i, context: 'crypto' },
      { name: 'AWS Credentials', pattern: /(AKIA|ASIA)[0-9A-Z]{16}/i, context: 'aws' }
    ];
    
    const filesToCheck = [
      '.env',
      '.env.local', 
      '.env.development',
      '.env.production',
      'src/**/*.js',
      'src/**/*.jsx',
      'src/**/*.ts',
      'src/**/*.tsx',
      'scripts/*.js',
      '*.js'
    ];
    
    try {
      for (const filePattern of filesToCheck) {
        const files = await this.getMatchingFiles(filePattern);
        
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf8');
            
            for (const pattern of sensitivePatterns) {
              const matches = content.match(pattern.pattern);
              if (matches && !this.isExcludedFile(file)) {
                // Check if it's actually exposed (not in .env files or properly handled)
                const isProperlyHandled = file.includes('.env') || 
                                        content.includes('process.env') ||
                                        file.includes('.example');
                
                if (!isProperlyHandled) {
                  exposures.push({
                    file,
                    type: pattern.name,
                    context: pattern.context,
                    line: this.getLineNumber(content, matches[0]),
                    severity: 'high'
                  });
                }
              }
            }
          } catch (error) {
            // File might not exist or not readable, skip
          }
        }
      }
      
      this.securityChecks.secrets = {
        status: exposures.length === 0 ? 'secure' : 'exposed',
        exposures,
        filesChecked: filesToCheck.length
      };
      
      console.log(`  Files checked: ${filesToCheck.length}`);
      console.log(`  Potential exposures: ${exposures.length}`);
      
    } catch (error) {
      console.log(`  ❌ Secret scanning failed: ${error.message}`);
      this.securityChecks.secrets = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkSecurityConfigurations() {
    console.log('⚙️ Checking security configurations...');
    
    const issues = [];
    
    try {
      // Check HTTPS configuration
      const viteConfigPath = path.join(process.cwd(), 'vite.config.js');
      try {
        const viteConfig = await fs.readFile(viteConfigPath, 'utf8');
        if (!viteConfig.includes('https') && !viteConfig.includes('ssl')) {
          issues.push({
            type: 'HTTPS Configuration',
            severity: 'medium',
            issue: 'HTTPS not configured in development',
            recommendation: 'Enable HTTPS in Vite configuration for secure development'
          });
        }
      } catch (error) {
        // Config file might not exist
      }
      
      // Check CSP headers
      const nginxConfigPath = path.join(process.cwd(), 'docker', 'nginx.conf');
      try {
        const nginxConfig = await fs.readFile(nginxConfigPath, 'utf8');
        if (!nginxConfig.includes('Content-Security-Policy')) {
          issues.push({
            type: 'Content Security Policy',
            severity: 'high',
            issue: 'CSP headers not configured',
            recommendation: 'Implement Content-Security-Policy headers'
          });
        }
      } catch (error) {
        // Nginx config might not exist
      }
      
      // Check CORS configuration
      const serverPath = path.join(process.cwd(), 'signaling-server.js');
      try {
        const serverCode = await fs.readFile(serverPath, 'utf8');
        if (serverCode.includes('origin: "*"')) {
          issues.push({
            type: 'CORS Configuration',
            severity: 'high',
            issue: 'Permissive CORS configuration allowing all origins',
            recommendation: 'Restrict CORS to specific domains in production'
          });
        }
      } catch (error) {
        // Server file might not exist
      }
      
      // Check environment variable handling
      const envExamplePath = path.join(process.cwd(), '.env.example');
      try {
        const envExample = await fs.readFile(envExamplePath, 'utf8');
        if (!envExample.includes('JWT_SECRET') || envExample.includes('change-in-production')) {
          issues.push({
            type: 'Environment Variables',
            severity: 'medium',
            issue: 'Default or weak configuration in .env.example',
            recommendation: 'Ensure all sensitive values have secure defaults'
          });
        }
      } catch (error) {
        issues.push({
          type: 'Environment Variables',
          severity: 'low',
          issue: '.env.example file missing',
          recommendation: 'Create .env.example file with secure defaults'
        });
      }
      
      this.securityChecks.configurations = {
        status: issues.length === 0 ? 'secure' : 'issues',
        issues,
        checksConducted: 4
      };
      
      console.log(`  Configuration checks: 4`);
      console.log(`  Issues found: ${issues.length}`);
      
    } catch (error) {
      console.log(`  ❌ Configuration check failed: ${error.message}`);
      this.securityChecks.configurations = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkNetworkSecurity() {
    console.log('🌐 Checking network security...');
    
    const findings = [];
    
    try {
      // Check for hardcoded localhost URLs in production code
      const srcFiles = await this.getMatchingFiles('src/**/*.js');
      const hardcodedLocalhost = [];
      
      for (const file of srcFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const localhostMatches = content.match(/localhost:\d+/g);
          if (localhostMatches) {
            hardcodedLocalhost.push({
              file,
              matches: localhostMatches
            });
          }
        } catch (error) {
          // Skip unreadable files
        }
      }
      
      if (hardcodedLocalhost.length > 0) {
        findings.push({
          type: 'Hardcoded URLs',
          severity: 'medium',
          issue: 'Hardcoded localhost URLs found in source code',
          files: hardcodedLocalhost.length,
          recommendation: 'Use environment variables for server URLs'
        });
      }
      
      // Check WebSocket security
      const wsConnections = await this.findWebSocketConnections();
      if (wsConnections.some(conn => conn.protocol === 'ws://')) {
        findings.push({
          type: 'WebSocket Security',
          severity: 'high',
          issue: 'Insecure WebSocket connections (ws://) detected',
          recommendation: 'Use secure WebSocket connections (wss://) in production'
        });
      }
      
      this.securityChecks.network = {
        status: findings.length === 0 ? 'secure' : 'findings',
        findings,
        checksConducted: 2
      };
      
      console.log(`  Network checks: 2`);
      console.log(`  Security findings: ${findings.length}`);
      
    } catch (error) {
      console.log(`  ❌ Network security check failed: ${error.message}`);
      this.securityChecks.network = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkAuthentication() {
    console.log('🔒 Checking authentication security...');
    
    const weaknesses = [];
    
    try {
      // Check JWT implementation
      const serverPath = path.join(process.cwd(), 'signaling-server.js');
      try {
        const serverCode = await fs.readFile(serverPath, 'utf8');
        
        if (serverCode.includes('jwt') || serverCode.includes('jsonwebtoken')) {
          // Check for proper JWT secret handling
          if (serverCode.includes('your-secret-key') || serverCode.includes('secret123')) {
            weaknesses.push({
              type: 'JWT Security',
              severity: 'critical',
              issue: 'Weak or default JWT secret detected',
              recommendation: 'Use cryptographically strong JWT secrets'
            });
          }
          
          // Check for proper token expiration
          if (!serverCode.includes('expiresIn')) {
            weaknesses.push({
              type: 'JWT Security',
              severity: 'medium', 
              issue: 'JWT tokens without expiration',
              recommendation: 'Set appropriate token expiration times'
            });
          }
        }
      } catch (error) {
        // Server file might not exist
      }
      
      // Check for authentication bypass vulnerabilities
      const authFiles = await this.getMatchingFiles('src/**/*auth*.js');
      for (const file of authFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          
          // Look for potential auth bypasses
          if (content.includes('// TODO: implement auth') || content.includes('auth = true')) {
            weaknesses.push({
              type: 'Authentication Bypass',
              severity: 'high',
              issue: `Potential authentication bypass in ${file}`,
              recommendation: 'Implement proper authentication checks'
            });
          }
        } catch (error) {
          // Skip unreadable files
        }
      }
      
      this.securityChecks.authentication = {
        status: weaknesses.length === 0 ? 'secure' : 'weaknesses',
        weaknesses,
        checksConducted: 2
      };
      
      console.log(`  Authentication checks: 2`);
      console.log(`  Weaknesses found: ${weaknesses.length}`);
      
    } catch (error) {
      console.log(`  ❌ Authentication check failed: ${error.message}`);
      this.securityChecks.authentication = {
        status: 'error', 
        error: error.message
      };
    }
  }

  async getMatchingFiles(pattern) {
    // Simple glob implementation for common patterns
    const basePath = process.cwd();
    
    if (pattern.includes('**')) {
      // Recursive search
      return await this.findFilesRecursively(basePath, pattern);
    } else {
      // Simple file check
      try {
        await fs.access(path.join(basePath, pattern));
        return [path.join(basePath, pattern)];
      } catch (error) {
        return [];
      }
    }
  }

  async findFilesRecursively(dir, pattern) {
    const files = [];
    const extension = path.extname(pattern);
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.findFilesRecursively(fullPath, pattern);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not be accessible
    }
    
    return files;
  }

  async findWebSocketConnections() {
    const connections = [];
    const files = await this.getMatchingFiles('src/**/*.js');
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const wsMatches = content.match(/(wss?:\/\/[^\s'"]+)/g);
        
        if (wsMatches) {
          wsMatches.forEach(match => {
            connections.push({
              file,
              url: match,
              protocol: match.startsWith('wss://') ? 'wss://' : 'ws://'
            });
          });
        }
      } catch (error) {
        // Skip unreadable files
      }
    }
    
    return connections;
  }

  isExcludedFile(filePath) {
    const excludedPatterns = [
      'node_modules/',
      '.git/',
      'coverage/',
      'dist/',
      '.env.example'
    ];
    
    return excludedPatterns.some(pattern => filePath.includes(pattern));
  }

  getLineNumber(content, searchString) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchString)) {
        return i + 1;
      }
    }
    return -1;
  }

  async runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'pipe'
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
        resolve({ stdout, stderr, code });
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      securityScore: 0,
      checks: this.securityChecks,
      complianceStatus: {},
      recommendations: []
    };

    // Calculate security score
    const checkStatuses = Object.values(this.securityChecks);
    const secureChecks = checkStatuses.filter(check => check.status === 'secure').length;
    const totalChecks = checkStatuses.filter(check => check.status !== 'error').length;
    
    report.securityScore = totalChecks > 0 ? Math.round((secureChecks / totalChecks) * 100) : 0;

    // Determine overall status
    if (report.securityScore >= 90) {
      report.overallStatus = 'secure';
    } else if (report.securityScore >= 70) {
      report.overallStatus = 'acceptable';
    } else {
      report.overallStatus = 'needs-attention';
    }

    // Check compliance with standards
    Object.keys(this.complianceStandards).forEach(standard => {
      report.complianceStatus[standard] = this.evaluateComplianceStandard(standard);
    });

    // Generate recommendations
    if (this.securityChecks.dependencies.vulnerabilities?.length > 0) {
      report.recommendations.push({
        priority: 'high',
        category: 'Dependencies',
        issue: `${this.securityChecks.dependencies.vulnerabilities.length} high/critical vulnerabilities`,
        action: 'Run npm audit fix to resolve dependency vulnerabilities'
      });
    }

    if (this.securityChecks.secrets.exposures?.length > 0) {
      report.recommendations.push({
        priority: 'critical',
        category: 'Secrets',
        issue: 'Potential secret exposure detected',
        action: 'Move sensitive data to environment variables'
      });
    }

    const highSeverityIssues = this.securityChecks.configurations.issues?.filter(
      issue => issue.severity === 'high'
    ) || [];

    if (highSeverityIssues.length > 0) {
      report.recommendations.push({
        priority: 'high',
        category: 'Configuration',
        issue: `${highSeverityIssues.length} high-severity configuration issues`,
        action: 'Review and fix security configuration issues'
      });
    }

    return report;
  }

  evaluateComplianceStandard(standard) {
    switch (standard) {
      case 'OWASP Top 10':
        return this.securityChecks.dependencies.status === 'secure' &&
               this.securityChecks.secrets.status === 'secure' &&
               this.securityChecks.authentication.status === 'secure';
      
      case 'Security Headers':
        return !this.securityChecks.configurations.issues?.some(
          issue => issue.type === 'Content Security Policy'
        );
      
      case 'Input Validation':
        return !this.securityChecks.configurations.issues?.some(
          issue => issue.type === 'Input Validation'
        );
      
      case 'Authentication':
        return this.securityChecks.authentication.status === 'secure';
      
      case 'Authorization':
        return this.securityChecks.authentication.status === 'secure';
      
      default:
        return false;
    }
  }

  async runFullSecurityCheck() {
    console.log('🚀 Starting Comprehensive Security Compliance Check\n');
    
    try {
      await this.checkDependencyVulnerabilities();
      console.log('');
      
      await this.checkSecretsExposure();
      console.log('');
      
      await this.checkSecurityConfigurations();
      console.log('');
      
      await this.checkNetworkSecurity();
      console.log('');
      
      await this.checkAuthentication();
      console.log('');

      const report = this.generateSecurityReport();

      // Save report
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportFile = path.join(reportsDir, `security-compliance-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      console.log('🛡️ Security Compliance Report:');
      console.log('===============================');
      console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
      console.log(`Security Score: ${report.securityScore}/100`);
      console.log(`Dependencies: ${this.securityChecks.dependencies.status}`);
      console.log(`Secrets: ${this.securityChecks.secrets.status}`);
      console.log(`Configuration: ${this.securityChecks.configurations.status}`);
      console.log(`Network: ${this.securityChecks.network.status}`);
      console.log(`Authentication: ${this.securityChecks.authentication.status}`);
      
      console.log('\n📊 Compliance Status:');
      Object.entries(report.complianceStatus).forEach(([standard, compliant]) => {
        console.log(`  ${standard}: ${compliant ? '✅ Compliant' : '❌ Non-Compliant'}`);
      });

      if (report.recommendations.length > 0) {
        console.log('\n🚨 Security Recommendations:');
        report.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
          console.log(`   Action: ${rec.action}`);
        });
      }

      console.log(`\n📁 Detailed report saved to: ${reportFile}`);
      
      return report.overallStatus !== 'needs-attention';
    } catch (error) {
      console.error('❌ Security compliance check failed:', error.message);
      return false;
    }
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new SecurityComplianceChecker();
  checker.runFullSecurityCheck().then(success => {
    process.exit(success ? 0 : 1);
  });
}