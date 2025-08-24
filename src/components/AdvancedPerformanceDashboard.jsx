/**
 * Advanced Performance Dashboard - Phase 1 Enhancement
 * 
 * Real-time performance analytics and monitoring dashboard:
 * - Connection establishment time tracking with 25-30% improvement visualization
 * - Failure reduction analytics with 40% target tracking
 * - AI-powered anomaly detection display
 * - Sub-100ms latency monitoring
 * - Comprehensive WebRTC performance metrics
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const AdvancedPerformanceDashboard = ({ 
  performanceMonitor, 
  isOpen, 
  onToggle, 
  position = 'bottom-right' 
}) => {
  // Dashboard state
  const [performanceData, setPerformanceData] = useState(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    connectionTime: [],
    latency: [],
    bandwidth: [],
    anomalies: []
  });
  const [achievements, setAchievements] = useState({
    connectionImprovement: { current: 0, target: 0.25, achieved: false },
    failureReduction: { current: 0, target: 0.4, achieved: false },
    latencyTarget: { current: 0, target: 100, achieved: false }
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const updateIntervalRef = useRef(null);
  const chartRefs = useRef({});
  
  // Initialize performance monitoring
  useEffect(() => {
    if (performanceMonitor && isOpen) {
      startRealTimeMonitoring();
    } else {
      stopRealTimeMonitoring();
    }
    
    return () => stopRealTimeMonitoring();
  }, [performanceMonitor, isOpen]);
  
  /**
   * Start real-time monitoring updates
   */
  const startRealTimeMonitoring = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    
    updateIntervalRef.current = setInterval(() => {
      updateDashboardData();
    }, 2000); // Update every 2 seconds
    
    // Initial data load
    updateDashboardData();
  }, [performanceMonitor]);
  
  /**
   * Stop real-time monitoring
   */
  const stopRealTimeMonitoring = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);
  
  /**
   * Update dashboard with latest performance data
   */
  const updateDashboardData = useCallback(async () => {
    if (!performanceMonitor) return;
    
    try {
      // Get comprehensive performance report
      const report = performanceMonitor.getPerformanceReport();
      setPerformanceData(report);
      
      // Update achievements tracking
      setAchievements(report.achievements);
      
      // Update real-time metrics
      setRealTimeMetrics(prev => ({
        connectionTime: [
          ...prev.connectionTime.slice(-19), // Keep last 20 data points
          {
            time: new Date().toLocaleTimeString(),
            value: report.connectionMetrics.averageEstablishmentTime || 0,
            target: 3000
          }
        ],
        latency: [
          ...prev.latency.slice(-19),
          {
            time: new Date().toLocaleTimeString(),
            value: report.performanceTargets.averageLatency || 0,
            target: 100
          }
        ],
        bandwidth: [
          ...prev.bandwidth.slice(-19),
          {
            time: new Date().toLocaleTimeString(),
            value: Math.random() * 3000000 + 1000000 // Simulated bandwidth data
          }
        ],
        anomalies: [
          ...prev.anomalies.slice(-9), // Keep last 10 anomalies
          ...generateMockAnomalies() // In real implementation, this would come from the monitor
        ]
      }));
      
    } catch (error) {
      console.error('Error updating dashboard data:', error);
    }
  }, [performanceMonitor]);
  
  /**
   * Generate mock anomalies for demonstration
   */
  const generateMockAnomalies = () => {
    const anomalyTypes = ['High Latency', 'Packet Loss', 'Low Bandwidth', 'Connection Issues'];
    const severities = ['warning', 'critical'];
    
    // Random chance of generating an anomaly
    if (Math.random() < 0.1) {
      return [{
        id: Date.now(),
        type: anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: Date.now(),
        resolved: false
      }];
    }
    
    return [];
  };
  
  /**
   * Chart configurations
   */
  const connectionTimeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 6000,
        ticks: {
          callback: (value) => `${value}ms`,
          color: '#94a3b8'
        },
        grid: { color: '#374151' }
      },
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: '#374151' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#f8fafc' }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc'
      }
    }
  };
  
  const connectionTimeChartData = {
    labels: realTimeMetrics.connectionTime.map(d => d.time),
    datasets: [
      {
        label: 'Connection Time',
        data: realTimeMetrics.connectionTime.map(d => d.value),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1
      },
      {
        label: 'Target (3s)',
        data: realTimeMetrics.connectionTime.map(d => d.target),
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderDash: [5, 5]
      }
    ]
  };
  
  const latencyChartData = {
    labels: realTimeMetrics.latency.map(d => d.time),
    datasets: [
      {
        label: 'Latency (ms)',
        data: realTimeMetrics.latency.map(d => d.value),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1
      },
      {
        label: 'Target (100ms)',
        data: realTimeMetrics.latency.map(d => d.target),
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderDash: [5, 5]
      }
    ]
  };
  
  const achievementChartData = {
    labels: ['Connection Time', 'Failure Reduction', 'Latency Target'],
    datasets: [{
      data: [
        achievements.connectionImprovement.current * 100,
        achievements.failureReduction.current * 100,
        achievements.latencyTarget.achieved ? 100 : 50
      ],
      backgroundColor: [
        achievements.connectionImprovement.achieved ? '#10b981' : '#f59e0b',
        achievements.failureReduction.achieved ? '#10b981' : '#f59e0b', 
        achievements.latencyTarget.achieved ? '#10b981' : '#f59e0b'
      ],
      borderColor: '#1f2937',
      borderWidth: 2
    }]
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed ${getPositionClasses(position)} z-50 ${
      isMinimized ? 'w-80 h-12' : 'w-[600px] h-[500px]'
    } bg-gray-900 border border-gray-700 rounded-lg shadow-2xl transition-all duration-300`}>
      
      {/* Dashboard Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-semibold text-white">Advanced Performance Monitor</h3>
          <div className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Phase 1</div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <div className="flex flex-col h-[456px]">
          
          {/* Performance Targets Overview */}
          <div className="p-4 bg-gray-850 border-b border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              
              {/* Connection Time Improvement */}
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Connection Time</div>
                <div className={`text-lg font-bold ${
                  achievements.connectionImprovement.achieved ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {(achievements.connectionImprovement.current * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Target: 25-30%</div>
                {achievements.connectionImprovement.achieved && (
                  <div className="text-xs text-green-400 mt-1">🎯 Achieved!</div>
                )}
              </div>
              
              {/* Failure Reduction */}
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Failure Reduction</div>
                <div className={`text-lg font-bold ${
                  achievements.failureReduction.achieved ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {(achievements.failureReduction.current * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Target: 40%</div>
                {achievements.failureReduction.achieved && (
                  <div className="text-xs text-green-400 mt-1">🎯 Achieved!</div>
                )}
              </div>
              
              {/* Latency Target */}
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Average Latency</div>
                <div className={`text-lg font-bold ${
                  achievements.latencyTarget.achieved ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {Math.round(achievements.latencyTarget.current)}ms
                </div>
                <div className="text-xs text-gray-500">Target: &lt;100ms</div>
                {achievements.latencyTarget.achieved && (
                  <div className="text-xs text-green-400 mt-1">🎯 Achieved!</div>
                )}
              </div>
              
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-gray-850">
            {['overview', 'metrics', 'anomalies'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 p-4 overflow-auto">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4 h-full">
                
                {/* Connection Time Chart */}
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Connection Establishment Time</h4>
                  <div className="h-32">
                    <Line 
                      ref={ref => chartRefs.current.connectionTime = ref}
                      data={connectionTimeChartData} 
                      options={connectionTimeChartOptions} 
                    />
                  </div>
                </div>
                
                {/* Latency Chart */}
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Latency Monitoring</h4>
                  <div className="h-32">
                    <Line 
                      ref={ref => chartRefs.current.latency = ref}
                      data={latencyChartData} 
                      options={connectionTimeChartOptions} 
                    />
                  </div>
                </div>
                
                {/* Achievement Progress */}
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Achievement Progress</h4>
                  <div className="h-32">
                    <Doughnut 
                      data={achievementChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: { 
                              color: '#f8fafc',
                              font: { size: 10 }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Connection Statistics */}
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Connection Statistics</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Active Connections:</span>
                      <span className="text-green-400">{performanceData?.activeConnections || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success Rate:</span>
                      <span className="text-green-400">
                        {((performanceData?.connectionMetrics?.successRate || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Connections:</span>
                      <span className="text-blue-400">{performanceData?.connectionMetrics?.totalConnections || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Failures:</span>
                      <span className="text-red-400">{performanceData?.connectionMetrics?.failures || 0}</span>
                    </div>
                  </div>
                </div>
                
              </div>
            )}
            
            {/* Metrics Tab */}
            {activeTab === 'metrics' && (
              <div className="space-y-4">
                
                {/* Real-time Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-3">Performance Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Connection Time:</span>
                        <span className="text-blue-400">
                          {(performanceData?.connectionMetrics?.averageEstablishmentTime || 0).toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Latency:</span>
                        <span className={`${
                          (performanceData?.performanceTargets?.averageLatency || 0) < 100 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {(performanceData?.performanceTargets?.averageLatency || 0).toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Connection Success:</span>
                        <span className="text-green-400">
                          {((performanceData?.performanceTargets?.connectionSuccessRate || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-3">AI Analytics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Anomalies Detected:</span>
                        <span className="text-red-400">{performanceData?.anomalyStats?.totalDetections || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Optimizations Applied:</span>
                        <span className="text-green-400">{performanceData?.optimizationStats?.totalOptimizations || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ML Models Active:</span>
                        <span className="text-blue-400">{performanceData?.anomalyStats?.activeModels || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Bandwidth Chart */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3">Bandwidth Usage</h4>
                  <div className="h-40">
                    <Line
                      data={{
                        labels: realTimeMetrics.bandwidth.map((_, i) => `${i * 2}s ago`).reverse(),
                        datasets: [{
                          label: 'Bandwidth (bps)',
                          data: realTimeMetrics.bandwidth.map(d => d.value),
                          borderColor: '#8b5cf6',
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          tension: 0.1
                        }]
                      }}
                      options={{
                        ...connectionTimeChartOptions,
                        scales: {
                          ...connectionTimeChartOptions.scales,
                          y: {
                            ...connectionTimeChartOptions.scales.y,
                            max: 4000000,
                            ticks: {
                              callback: (value) => `${(value / 1000000).toFixed(1)}M`,
                              color: '#94a3b8'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
              </div>
            )}
            
            {/* Anomalies Tab */}
            {activeTab === 'anomalies' && (
              <div className="space-y-4">
                
                {/* Anomaly List */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3">Recent Anomalies</h4>
                  
                  {realTimeMetrics.anomalies.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-green-400 text-2xl mb-2">✅</div>
                      <div>No anomalies detected</div>
                      <div className="text-xs">All systems operating normally</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {realTimeMetrics.anomalies.slice(-10).reverse().map(anomaly => (
                        <div 
                          key={anomaly.id} 
                          className={`flex items-center justify-between p-3 rounded border ${
                            anomaly.severity === 'critical' 
                              ? 'bg-red-900/20 border-red-500' 
                              : 'bg-yellow-900/20 border-yellow-500'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-2 h-2 rounded-full ${
                              anomaly.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></div>
                            <div>
                              <div className="text-sm font-medium text-white">{anomaly.type}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(anomaly.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            anomaly.severity === 'critical' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-yellow-500 text-black'
                          }`}>
                            {anomaly.severity}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Anomaly Statistics */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3">Anomaly Statistics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Total Detected:</div>
                      <div className="text-red-400 font-semibold">{realTimeMetrics.anomalies.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Critical:</div>
                      <div className="text-red-500 font-semibold">
                        {realTimeMetrics.anomalies.filter(a => a.severity === 'critical').length}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Warnings:</div>
                      <div className="text-yellow-500 font-semibold">
                        {realTimeMetrics.anomalies.filter(a => a.severity === 'warning').length}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Resolved:</div>
                      <div className="text-green-400 font-semibold">
                        {realTimeMetrics.anomalies.filter(a => a.resolved).length}
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            )}
            
          </div>
          
        </div>
      )}
      
    </div>
  );
};

/**
 * Get positioning classes based on position prop
 */
const getPositionClasses = (position) => {
  switch (position) {
    case 'top-left':
      return 'top-4 left-4';
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'bottom-right':
    default:
      return 'bottom-4 right-4';
  }
};

export default AdvancedPerformanceDashboard;