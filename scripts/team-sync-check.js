#!/usr/bin/env node

/**
 * Team Synchronization Check
 * Validates cross-agent coordination and collaboration status
 * Ensures all enhancement phases are properly coordinated
 */

import fs from 'fs/promises';
import path from 'path';

class TeamSyncChecker {
  constructor() {
    this.agents = [
      'performance-engineer',
      'cloud-architect', 
      'security-auditor',
      'ux-designer',
      'dx-optimizer'
    ];
    
    this.syncResults = {
      coordination: { status: 'unknown', details: {} },
      documentation: { status: 'unknown', coverage: {} },
      dependencies: { status: 'unknown', conflicts: [] },
      standards: { status: 'unknown', violations: [] }
    };
  }

  async checkCoordinationArtifacts() {
    console.log('🤝 Checking cross-agent coordination artifacts...');
    
    const coordinationChecks = {
      'Performance Monitoring': [
        'scripts/performance-audit.js',
        'scripts/performance-profiler.js',
        'tests/load/*.js'
      ],
      'Security Integration': [
        'scripts/security-scan.js',
        'scripts/security-compliance-check.js',
        '.github/workflows/security-scan.yml'
      ],
      'Infrastructure Automation': [
        'docker/Dockerfile.frontend',
        'docker/Dockerfile.backend', 
        'k8s/**.yaml'
      ],
      'Development Tooling': [
        '.vscode/settings.json',
        '.vscode/launch.json',
        'scripts/dev-monitor.js'
      ],
      'UX Testing Framework': [
        'tests/e2e/*.spec.js',
        'playwright.config.js'
      ]
    };

    const results = {};
    
    for (const [area, files] of Object.entries(coordinationChecks)) {
      console.log(`  Checking ${area}...`);
      const areaResults = {
        requiredFiles: files.length,
        existingFiles: 0,
        missingFiles: []
      };

      for (const file of files) {
        try {
          if (file.includes('**')) {
            // Handle glob patterns
            const globPattern = file.replace('**', '*');
            const dirPath = path.dirname(globPattern);
            const basePath = path.join(process.cwd(), dirPath);
            
            try {
              const dirContents = await fs.readdir(basePath);
              const matchingFiles = dirContents.filter(f => 
                f.endsWith(path.extname(globPattern)) || 
                f.includes(path.basename(globPattern, path.extname(globPattern)))
              );
              
              if (matchingFiles.length > 0) {
                areaResults.existingFiles += matchingFiles.length;
              } else {
                areaResults.missingFiles.push(file);
              }
            } catch (error) {
              areaResults.missingFiles.push(file);
            }
          } else {
            const filePath = path.join(process.cwd(), file);
            await fs.access(filePath);
            areaResults.existingFiles++;
          }
        } catch (error) {
          areaResults.missingFiles.push(file);
        }
      }

      areaResults.coverage = Math.round((areaResults.existingFiles / areaResults.requiredFiles) * 100);
      results[area] = areaResults;
      
      console.log(`    Coverage: ${areaResults.coverage}% (${areaResults.existingFiles}/${areaResults.requiredFiles})`);
    }

    this.syncResults.coordination = {
      status: Object.values(results).every(r => r.coverage >= 80) ? 'good' : 'partial',
      details: results
    };
  }

  async checkDocumentationStandards() {
    console.log('📚 Checking documentation standards...');
    
    const requiredDocs = [
      'README.md',
      'CLAUDE.md',
      'package.json',
      '.env.example'
    ];

    const docResults = {};
    
    for (const doc of requiredDocs) {
      try {
        const filePath = path.join(process.cwd(), doc);
        const content = await fs.readFile(filePath, 'utf8');
        
        docResults[doc] = {
          exists: true,
          size: content.length,
          lastModified: (await fs.stat(filePath)).mtime
        };

        // Check for agent-specific sections
        const agentSections = this.agents.filter(agent => 
          content.toLowerCase().includes(agent.replace('-', ' '))
        );
        
        docResults[doc].agentCoverage = agentSections.length;
        console.log(`  ${doc}: ✅ (${agentSections.length} agent references)`);
      } catch (error) {
        docResults[doc] = { exists: false, error: error.message };
        console.log(`  ${doc}: ❌ Missing`);
      }
    }

    const totalAgentCoverage = Object.values(docResults)
      .reduce((sum, doc) => sum + (doc.agentCoverage || 0), 0);
    
    this.syncResults.documentation = {
      status: Object.values(docResults).every(d => d.exists) ? 'complete' : 'incomplete',
      coverage: docResults,
      agentCoverage: totalAgentCoverage
    };
  }

  async checkDependencyConflicts() {
    console.log('📦 Checking dependency conflicts...');
    
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      const conflicts = [];
      const dependencies = { 
        ...packageContent.dependencies, 
        ...packageContent.devDependencies 
      };

      // Check for known conflicting patterns
      const conflictPatterns = [
        { packages: ['react', 'preact'], type: 'framework' },
        { packages: ['webpack', 'vite', 'rollup'], type: 'bundler' },
        { packages: ['jest', 'vitest', 'mocha'], type: 'testing' }
      ];

      for (const pattern of conflictPatterns) {
        const foundPackages = pattern.packages.filter(pkg => dependencies[pkg]);
        if (foundPackages.length > 1) {
          conflicts.push({
            type: pattern.type,
            packages: foundPackages,
            recommendation: `Consider using only one ${pattern.type} framework`
          });
        }
      }

      // Check for outdated versions
      const criticalPackages = ['react', 'node', 'typescript'];
      const outdated = [];
      
      for (const pkg of criticalPackages) {
        if (dependencies[pkg]) {
          const version = dependencies[pkg];
          if (version.includes('^') && !version.includes('18') && pkg === 'react') {
            outdated.push({
              package: pkg,
              current: version,
              recommendation: 'Consider upgrading to React 18+'
            });
          }
        }
      }

      this.syncResults.dependencies = {
        status: conflicts.length === 0 ? 'clean' : 'conflicts',
        conflicts,
        outdated,
        totalDependencies: Object.keys(dependencies).length
      };

      console.log(`  Dependencies: ${Object.keys(dependencies).length} total`);
      console.log(`  Conflicts: ${conflicts.length}`);
      console.log(`  Outdated: ${outdated.length}`);
    } catch (error) {
      this.syncResults.dependencies = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkCodingStandards() {
    console.log('📝 Checking coding standards compliance...');
    
    const standardChecks = {
      'ESLint Configuration': '.eslintrc.js',
      'Prettier Configuration': '.prettierrc',
      'TypeScript Configuration': 'tsconfig.json', 
      'Editor Configuration': '.editorconfig',
      'Git Ignore': '.gitignore'
    };

    const violations = [];
    let compliantFiles = 0;

    for (const [standard, file] of Object.entries(standardChecks)) {
      try {
        await fs.access(path.join(process.cwd(), file));
        compliantFiles++;
        console.log(`  ${standard}: ✅`);
      } catch (error) {
        violations.push({
          standard,
          file,
          issue: 'File missing',
          recommendation: `Create ${file} for consistent code formatting`
        });
        console.log(`  ${standard}: ❌ Missing ${file}`);
      }
    }

    // Check VSCode workspace settings
    try {
      const vscodeSettings = path.join(process.cwd(), '.vscode', 'settings.json');
      await fs.access(vscodeSettings);
      compliantFiles++;
      console.log('  VSCode Settings: ✅');
    } catch (error) {
      violations.push({
        standard: 'VSCode Configuration',
        file: '.vscode/settings.json',
        issue: 'Workspace settings missing',
        recommendation: 'Configure VSCode workspace settings for team consistency'
      });
    }

    this.syncResults.standards = {
      status: violations.length === 0 ? 'compliant' : 'violations',
      violations,
      compliance: Math.round((compliantFiles / (Object.keys(standardChecks).length + 1)) * 100)
    };
  }

  generateSyncReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      results: this.syncResults,
      recommendations: []
    };

    // Generate overall status
    const statuses = [
      this.syncResults.coordination.status,
      this.syncResults.documentation.status, 
      this.syncResults.dependencies.status,
      this.syncResults.standards.status
    ];

    const hasGoodStatuses = statuses.includes('good') || statuses.includes('complete') || statuses.includes('clean') || statuses.includes('compliant');
    const hasErrors = statuses.includes('error') || statuses.includes('conflicts');
    
    if (hasErrors) {
      report.overallStatus = 'needs-attention';
    } else if (hasGoodStatuses && !statuses.includes('unknown')) {
      report.overallStatus = 'good';
    } else {
      report.overallStatus = 'partial';
    }

    // Generate recommendations
    if (this.syncResults.coordination.status === 'partial') {
      report.recommendations.push({
        type: 'coordination',
        priority: 'high',
        message: 'Incomplete coordination artifacts detected',
        action: 'Ensure all agent areas have required tooling and integration points'
      });
    }

    if (this.syncResults.dependencies.conflicts.length > 0) {
      report.recommendations.push({
        type: 'dependencies',
        priority: 'medium',
        message: 'Dependency conflicts detected',
        action: 'Review and resolve package conflicts to avoid runtime issues'
      });
    }

    if (this.syncResults.standards.compliance < 80) {
      report.recommendations.push({
        type: 'standards',
        priority: 'medium', 
        message: 'Coding standards compliance below 80%',
        action: 'Implement missing configuration files for consistent development'
      });
    }

    if (this.syncResults.documentation.agentCoverage < this.agents.length) {
      report.recommendations.push({
        type: 'documentation',
        priority: 'low',
        message: 'Not all agents documented in project files',
        action: 'Update documentation to include all agent coordination points'
      });
    }

    return report;
  }

  async runFullSync() {
    console.log('🚀 Starting Team Synchronization Check\n');
    
    try {
      await this.checkCoordinationArtifacts();
      console.log('');
      
      await this.checkDocumentationStandards();
      console.log('');
      
      await this.checkDependencyConflicts();
      console.log('');
      
      await this.checkCodingStandards();
      console.log('');

      const report = this.generateSyncReport();

      // Save report
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportFile = path.join(reportsDir, `team-sync-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      console.log('📊 Team Synchronization Report:');
      console.log('================================');
      console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
      console.log(`Coordination: ${this.syncResults.coordination.status}`);
      console.log(`Documentation: ${this.syncResults.documentation.status}`);
      console.log(`Dependencies: ${this.syncResults.dependencies.status}`);
      console.log(`Standards: ${this.syncResults.standards.status} (${this.syncResults.standards.compliance}%)`);
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
          console.log(`   Action: ${rec.action}`);
        });
      }

      console.log(`\n📁 Detailed report saved to: ${reportFile}`);
      return report.overallStatus === 'good';
    } catch (error) {
      console.error('❌ Team sync check failed:', error.message);
      return false;
    }
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new TeamSyncChecker();
  checker.runFullSync().then(success => {
    process.exit(success ? 0 : 1);
  });
}