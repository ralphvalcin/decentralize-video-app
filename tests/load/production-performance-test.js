// Production Performance Test
// Simplified load testing for the production environment

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import http from 'k6/http';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

// Production URLs
const FRONTEND_URL = 'https://decentralized-video-app.vercel.app';
const BACKEND_URL = 'https://decentralize-video-app-2.onrender.com';
const WEBSOCKET_URL = 'wss://decentralize-video-app-2.onrender.com';

// Custom metrics
const frontendLoadTime = new Trend('frontend_load_time');
const backendResponseTime = new Trend('backend_response_time');
const websocketConnectionTime = new Trend('websocket_connection_time');
const healthCheckSuccess = new Rate('health_check_success');
const websocketConnectionSuccess = new Rate('websocket_connection_success');
const frontendAccessibility = new Rate('frontend_accessibility');

export let options = {
  scenarios: {
    // Frontend load testing
    frontend_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 15 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      env: { TEST_TYPE: 'frontend' }
    },
    
    // Backend health and API testing
    backend_health: {
      executor: 'constant-vus',
      vus: 10,
      duration: '3m',
      startTime: '1m',
      env: { TEST_TYPE: 'backend' }
    },
    
    // WebSocket connection testing
    websocket_test: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      startTime: '2m',
      env: { TEST_TYPE: 'websocket' }
    }
  },
  
  thresholds: {
    frontend_load_time: ['p(95)<3000', 'p(99)<5000'],
    backend_response_time: ['p(95)<1000', 'p(99)<2000'],
    websocket_connection_time: ['p(95)<2000', 'p(99)<3000'],
    health_check_success: ['rate>0.95'],
    websocket_connection_success: ['rate>0.90'],
    frontend_accessibility: ['rate>0.98'],
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05']
  }
};

export default function() {
  const testType = __ENV.TEST_TYPE || 'frontend';
  
  switch(testType) {
    case 'frontend':
      testFrontend();
      break;
    case 'backend':
      testBackend();
      break;
    case 'websocket':
      testWebSocket();
      break;
    default:
      testFrontend();
  }
}

function testFrontend() {
  const startTime = Date.now();
  
  // Test frontend loading
  const response = http.get(FRONTEND_URL, {
    timeout: '10s',
    headers: {
      'User-Agent': 'k6-performance-test/1.0'
    }
  });
  
  const loadTime = Date.now() - startTime;
  frontendLoadTime.add(loadTime);
  
  const success = check(response, {
    'frontend status is 200': (r) => r.status === 200,
    'frontend has content': (r) => r.body && r.body.length > 0,
    'frontend load time < 5s': () => loadTime < 5000,
    'frontend contains expected elements': (r) => r.body.includes('video') || r.body.includes('room') || r.body.includes('chat'),
  });
  
  frontendAccessibility.add(success);
  
  sleep(1);
}

function testBackend() {
  // Test health endpoint
  const startTime = Date.now();
  
  const healthResponse = http.get(`${BACKEND_URL}/health`, {
    timeout: '5s'
  });
  
  const responseTime = Date.now() - startTime;
  backendResponseTime.add(responseTime);
  
  const healthSuccess = check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 2s': () => responseTime < 2000,
    'health has status OK': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.status === 'OK';
      } catch {
        return false;
      }
    },
    'health has uptime': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.uptime && data.uptime > 0;
      } catch {
        return false;
      }
    }
  });
  
  healthCheckSuccess.add(healthSuccess);
  
  // Test any public API endpoints
  const apiResponse = http.get(`${BACKEND_URL}/`, {
    timeout: '3s'
  });
  
  check(apiResponse, {
    'api endpoint accessible': (r) => r.status < 500
  });
  
  sleep(2);
}

function testWebSocket() {
  const startTime = Date.now();
  
  const response = ws.connect(WEBSOCKET_URL, {}, function(socket) {
    const connectionTime = Date.now() - startTime;
    websocketConnectionTime.add(connectionTime);
    
    socket.on('open', function() {
      console.log('WebSocket connected successfully');
      
      // Test basic signaling messages
      socket.send(JSON.stringify({
        type: 'test',
        data: { message: 'load test connection' }
      }));
    });
    
    socket.on('message', function(data) {
      console.log('Received WebSocket message');
    });
    
    socket.on('error', function(error) {
      console.log('WebSocket error:', error);
    });
    
    // Keep connection open for testing
    socket.setTimeout(function() {
      socket.close();
    }, 5000);
  });
  
  const wsSuccess = check(response, {
    'websocket connection successful': (r) => r && r.status === 101
  });
  
  websocketConnectionSuccess.add(wsSuccess);
  
  sleep(6);
}

export function handleSummary(data) {
  return {
    'production-performance-results.json': JSON.stringify(data, null, 2),
    stdout: `
=== PRODUCTION PERFORMANCE TEST RESULTS ===

Frontend Performance:
- Load Time P95: ${data.metrics.frontend_load_time?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms
- Load Time P99: ${data.metrics.frontend_load_time?.values?.['p(99)']?.toFixed(0) || 'N/A'}ms
- Accessibility Rate: ${(data.metrics.frontend_accessibility?.values?.rate * 100)?.toFixed(1) || 'N/A'}%

Backend Performance:
- Response Time P95: ${data.metrics.backend_response_time?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms
- Response Time P99: ${data.metrics.backend_response_time?.values?.['p(99)']?.toFixed(0) || 'N/A'}ms
- Health Check Success: ${(data.metrics.health_check_success?.values?.rate * 100)?.toFixed(1) || 'N/A'}%

WebSocket Performance:
- Connection Time P95: ${data.metrics.websocket_connection_time?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms
- Connection Time P99: ${data.metrics.websocket_connection_time?.values?.['p(99)']?.toFixed(0) || 'N/A'}ms
- Connection Success Rate: ${(data.metrics.websocket_connection_success?.values?.rate * 100)?.toFixed(1) || 'N/A'}%

Overall HTTP Performance:
- Request Duration P95: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms
- Request Failure Rate: ${(data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(1) || 'N/A'}%

Test Summary:
- Total VUs: ${data.root_group?.checks?.passes + data.root_group?.checks?.fails || 'N/A'}
- Total Requests: ${data.metrics.http_reqs?.values?.count || 'N/A'}
- Total Checks: ${data.root_group?.checks?.passes || 'N/A'} passed, ${data.root_group?.checks?.fails || 'N/A'} failed
- Test Duration: ${((data.state?.testRunDurationMs || 0) / 1000).toFixed(1)}s
`,
  };
}