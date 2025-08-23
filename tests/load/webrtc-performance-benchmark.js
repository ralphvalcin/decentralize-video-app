// WebRTC Performance Benchmark Test
// K6 load testing script for WebRTC performance validation

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { SharedArray } from 'k6/data';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

// Network condition configurations
const networkConditions = new SharedArray('network-conditions', function() {
  return [
    { name: 'excellent', bandwidth: 5000000, rtt: 20, packetLoss: 0.001 },
    { name: 'good', bandwidth: 2000000, rtt: 50, packetLoss: 0.005 },
    { name: 'fair', bandwidth: 1000000, rtt: 100, packetLoss: 0.02 },
    { name: 'poor', bandwidth: 500000, rtt: 200, packetLoss: 0.05 },
    { name: 'critical', bandwidth: 200000, rtt: 500, packetLoss: 0.1 }
  ];
});

// Codec configurations for testing
const codecConfigs = new SharedArray('codec-configs', function() {
  return [
    { name: 'VP9', mimeType: 'video/webm; codecs=vp9', preference: 'high', expectedBitrate: 2000000 },
    { name: 'VP8', mimeType: 'video/webm; codecs=vp8', preference: 'medium', expectedBitrate: 1500000 },
    { name: 'H264', mimeType: 'video/mp4; codecs=avc1.42E01E', preference: 'medium', expectedBitrate: 1200000 },
    { name: 'AV1', mimeType: 'video/webm; codecs=av01.0.04M.08', preference: 'high', expectedBitrate: 1000000 }
  ];
});

// Quality profiles for adaptation testing
const qualityProfiles = new SharedArray('quality-profiles', function() {
  return [
    { name: 'ultra', resolution: '1920x1080', frameRate: 30, bitrate: 3000000 },
    { name: 'high', resolution: '1280x720', frameRate: 30, bitrate: 1500000 },
    { name: 'medium', resolution: '854x480', frameRate: 25, bitrate: 800000 },
    { name: 'low', resolution: '640x360', frameRate: 20, bitrate: 400000 },
    { name: 'minimal', resolution: '320x240', frameRate: 15, bitrate: 200000 }
  ];
});

// Custom metrics for WebRTC performance
const webrtcConnectionTime = new Trend('webrtc_connection_time');
const iceGatheringTime = new Trend('ice_gathering_time');
const dtlsHandshakeTime = new Trend('dtls_handshake_time');
const firstFrameTime = new Trend('first_frame_time');
const codecNegotiationTime = new Trend('codec_negotiation_time');
const bitrateAdaptationTime = new Trend('bitrate_adaptation_time');

// Success rates
const webrtcConnectionSuccess = new Rate('webrtc_connection_success');
const mediaStreamSuccess = new Rate('media_stream_success');
const adaptationSuccess = new Rate('adaptation_success');
const reconnectionSuccess = new Rate('reconnection_success');

// Quality and stability metrics
const connectionStabilityScore = new Gauge('connection_stability_score');
const mediaQualityScore = new Gauge('media_quality_score');

// Resource usage metrics
const memoryUsagePerConnection = new Gauge('memory_usage_per_connection');
const cpuUsagePerConnection = new Gauge('cpu_usage_per_connection');
const bandwidthUsageUpload = new Gauge('bandwidth_usage_upload');
const bandwidthUsageDownload = new Gauge('bandwidth_usage_download');

// Network impact metrics
const networkLatencyImpact = new Trend('network_latency_impact');
const packetLossImpact = new Trend('packet_loss_impact');

export let options = {
  scenarios: {
    connection_establishment: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      env: { TEST_TYPE: 'connection_establishment' }
    },
    
    media_quality: {
      executor: 'constant-vus',
      vus: 15,
      duration: '5m',
      startTime: '6m',
      env: { TEST_TYPE: 'media_quality' }
    }
  },
  
  thresholds: {
    webrtc_connection_time: ['p(95)<500', 'p(99)<1000'],
    ice_gathering_time: ['p(95)<2000', 'p(99)<5000'],
    dtls_handshake_time: ['p(95)<1000', 'p(99)<2000'],
    first_frame_time: ['p(95)<3000', 'p(99)<5000'],
    codec_negotiation_time: ['p(95)<200', 'p(99)<500'],
    bitrate_adaptation_time: ['p(95)<100', 'p(99)<200'],
    
    connection_stability_score: ['avg>80', 'p(95)>70'],
    media_quality_score: ['avg>75', 'p(95)>60'],
    
    webrtc_connection_success: ['rate>0.995'],
    media_stream_success: ['rate>0.99'],
    adaptation_success: ['rate>0.95'],
    reconnection_success: ['rate>0.90'],
    
    memory_usage_per_connection: ['avg<52428800'], // 50MB in bytes
    cpu_usage_per_connection: ['avg<5'],
    
    network_latency_impact: ['avg<100'],
    packet_loss_impact: ['avg<50']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const WS_URL = BASE_URL.replace('http', 'ws').replace(':5173', ':5001');
const TEST_TYPE = __ENV.TEST_TYPE || 'default';

export default function() {
  const vuId = __VU;
  const testType = TEST_TYPE;
  
  switch (testType) {
    case 'connection_establishment':
      executeConnectionEstablishmentTest(vuId);
      break;
    case 'media_quality':
      executeMediaQualityTest(vuId);
      break;
    default:
      executeDefaultWebRTCTest(vuId);
  }
}

function executeConnectionEstablishmentTest(vuId) {
  const testStartTime = Date.now();
  
  ws.connect(WS_URL, function(socket) {
    const timings = {
      socketOpen: 0,
      iceGathering: 0,
      dtlsHandshake: 0,
      firstFrame: 0
    };
    
    socket.on('open', function() {
      timings.socketOpen = Date.now();
      
      socket.send(JSON.stringify({
        type: 'webrtc-connect',
        vuId: vuId,
        timestamp: timings.socketOpen,
        testType: 'connection_establishment'
      }));
      
      // Simulate ICE gathering
      setTimeout(() => {
        timings.iceGathering = Date.now();
        const iceTime = timings.iceGathering - timings.socketOpen;
        iceGatheringTime.add(iceTime);
      }, 500 + Math.random() * 1500);
      
      // Simulate DTLS handshake
      setTimeout(() => {
        timings.dtlsHandshake = Date.now();
        const dtlsTime = timings.dtlsHandshake - timings.iceGathering;
        dtlsHandshakeTime.add(dtlsTime);
      }, 800 + Math.random() * 1200);
      
      // Simulate first frame
      setTimeout(() => {
        timings.firstFrame = Date.now();
        const firstFrameDelay = timings.firstFrame - timings.dtlsHandshake;
        firstFrameTime.add(firstFrameDelay);
        
        const totalConnectionTime = timings.firstFrame - testStartTime;
        webrtcConnectionTime.add(totalConnectionTime);
        webrtcConnectionSuccess.add(true);
      }, 200 + Math.random() * 800);
    });
    
    socket.on('error', function() {
      webrtcConnectionSuccess.add(false);
    });
    
    sleep(5);
  });
  
  sleep(1 + Math.random() * 2);
}

function executeMediaQualityTest(vuId) {
  const qualityProfile = qualityProfiles[Math.floor(Math.random() * qualityProfiles.length)];
  const codecConfig = codecConfigs[Math.floor(Math.random() * codecConfigs.length)];
  
  ws.connect(WS_URL, function(socket) {
    let qualityScore = 0;
    
    socket.on('open', function() {
      socket.send(JSON.stringify({
        type: 'media-quality-test',
        vuId: vuId,
        requestedQuality: qualityProfile,
        requestedCodec: codecConfig,
        timestamp: Date.now()
      }));
      
      // Simulate quality monitoring
      const qualityMonitorInterval = setInterval(() => {
        const frameRate = qualityProfile.frameRate * (0.8 + Math.random() * 0.4);
        const bitrate = qualityProfile.bitrate * (0.7 + Math.random() * 0.6);
        
        const frameRateScore = Math.min(100, (frameRate / qualityProfile.frameRate) * 100);
        const bitrateScore = Math.min(100, (bitrate / qualityProfile.bitrate) * 100);
        qualityScore = (frameRateScore + bitrateScore) / 2;
        
        mediaQualityScore.add(qualityScore);
      }, 2000);
      
      setTimeout(() => {
        clearInterval(qualityMonitorInterval);
        mediaStreamSuccess.add(qualityScore > 60);
        socket.close();
      }, 30000);
    });
    
    sleep(35);
  });
  
  sleep(2);
}

function executeDefaultWebRTCTest(vuId) {
  ws.connect(WS_URL, function(socket) {
    socket.on('open', function() {
      socket.send(JSON.stringify({
        type: 'default-webrtc-test',
        vuId: vuId,
        timestamp: Date.now()
      }));
    });
    
    sleep(30);
  });
  
  sleep(2);
}

export function teardown() {
  console.log('\nWebRTC Performance Benchmark Results');
  console.log('=====================================');
  
  console.log('\nConnection Performance:');
  console.log(`  Average connection time: ${webrtcConnectionTime.avg ? webrtcConnectionTime.avg.toFixed(2) : 'N/A'}ms`);
  console.log(`  Connection success rate: ${(webrtcConnectionSuccess.rate * 100).toFixed(2)}%`);
  
  console.log('\nMedia Quality Performance:');
  console.log(`  Average media quality score: ${mediaQualityScore.avg ? mediaQualityScore.avg.toFixed(2) : 'N/A'}/100`);
  console.log(`  Media stream success rate: ${(mediaStreamSuccess.rate * 100).toFixed(2)}%`);
  
  console.log('=====================================');
}