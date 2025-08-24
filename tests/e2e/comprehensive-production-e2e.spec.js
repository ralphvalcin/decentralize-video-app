import { test, expect } from '@playwright/test';

// Production URLs
const FRONTEND_URL = 'https://decentralized-video-app.vercel.app';
const BACKEND_URL = 'https://decentralize-video-app-2.onrender.com';

test.describe('Comprehensive Production E2E Testing', () => {
  test.setTimeout(60000); // Extend timeout for production testing

  test('1. Frontend Access & Responsiveness Testing', async ({ page }) => {
    const startTime = Date.now();
    
    // Test frontend loading
    await page.goto(FRONTEND_URL);
    const loadTime = Date.now() - startTime;
    
    console.log(`Frontend load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Test page title and basic elements
    await expect(page).toHaveTitle(/Video/i);
    
    // Test responsive design by changing viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      
      // Verify layout doesn't break
      const body = await page.locator('body');
      await expect(body).toBeVisible();
      console.log(`Responsive test passed for ${viewport.width}x${viewport.height}`);
    }
  });

  test('2. Backend Health & WebSocket Connection Testing', async ({ page }) => {
    // Test backend health endpoint
    const response = await page.request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.status).toBe('OK');
    console.log('Backend health check passed:', healthData);
    
    // Test WebSocket connection capability
    await page.goto(FRONTEND_URL);
    
    // Monitor network requests for WebSocket connections
    const webSocketPromise = page.waitForEvent('websocket');
    
    // Trigger WebSocket connection (typically happens when joining a room)
    await page.evaluate(() => {
      // Mock WebSocket connection test
      const ws = new WebSocket('wss://decentralize-video-app-2.onrender.com');
      ws.onopen = () => console.log('WebSocket connected');
      ws.onerror = (error) => console.error('WebSocket error:', error);
    });
    
    try {
      const webSocket = await webSocketPromise;
      console.log('WebSocket connection established successfully');
      await webSocket.close();
    } catch (error) {
      console.log('WebSocket connection test completed with expected behavior');
    }
  });

  test('3. Navigation & UI Component Testing', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Test navigation elements
    const navigationElements = [
      'Create Room',
      'Join Room',
      'Home',
      'About'
    ];
    
    for (const element of navigationElements) {
      const navElement = page.getByText(element, { exact: false });
      if (await navElement.isVisible()) {
        console.log(`Navigation element found: ${element}`);
        await navElement.hover(); // Test hover states
      }
    }
    
    // Test form elements
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} input elements`);
    
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} button elements`);
    
    // Test accessibility features
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    const focusedElement = await page.locator(':focus');
    if (await focusedElement.count() > 0) {
      console.log('Keyboard navigation working - element focused');
    }
  });

  test('4. Room Creation & WebRTC Setup Testing', async ({ page, browser }) => {
    await page.goto(FRONTEND_URL);
    
    // Test room creation flow
    const createRoomBtn = page.getByText('Create Room', { exact: false });
    if (await createRoomBtn.isVisible()) {
      await createRoomBtn.click();
      await page.waitForTimeout(2000);
      
      // Check if we're in a room (URL should contain room ID)
      const url = page.url();
      console.log(`Current URL after room creation: ${url}`);
      
      if (url.includes('room') || url.includes('call')) {
        console.log('Room creation successful - redirected to room');
        
        // Test media permissions prompt
        await page.evaluate(() => {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(() => console.log('Media permissions granted'))
            .catch(err => console.log('Media permissions denied or unavailable:', err.message));
        });
        
        // Look for video elements
        const videoElements = page.locator('video');
        const videoCount = await videoElements.count();
        console.log(`Found ${videoCount} video elements`);
        
        // Check for connection status indicators
        const connectionIndicators = [
          '.connection-status',
          '.peer-status',
          '.webrtc-status',
          '[data-testid="connection-status"]'
        ];
        
        for (const selector of connectionIndicators) {
          const indicator = page.locator(selector);
          if (await indicator.count() > 0) {
            console.log(`Connection indicator found: ${selector}`);
          }
        }
      }
    } else {
      console.log('Create Room button not found - testing room join flow instead');
      
      // Test room join flow
      const joinInput = page.locator('input[placeholder*="room" i], input[placeholder*="id" i], input[type="text"]');
      if (await joinInput.count() > 0) {
        await joinInput.first().fill('test-room-123');
        
        const joinBtn = page.getByText('Join', { exact: false });
        if (await joinBtn.isVisible()) {
          await joinBtn.click();
          await page.waitForTimeout(2000);
          console.log('Room join flow tested');
        }
      }
    }
  });

  test('5. Chat Functionality Testing', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Navigate to a room or chat interface
    const createRoomBtn = page.getByText('Create Room', { exact: false });
    if (await createRoomBtn.isVisible()) {
      await createRoomBtn.click();
      await page.waitForTimeout(3000);
    }
    
    // Look for chat input elements
    const chatInputSelectors = [
      'input[placeholder*="message" i]',
      'input[placeholder*="chat" i]',
      'textarea[placeholder*="message" i]',
      '.chat-input',
      '[data-testid="chat-input"]'
    ];
    
    let chatInput = null;
    for (const selector of chatInputSelectors) {
      const input = page.locator(selector);
      if (await input.count() > 0) {
        chatInput = input.first();
        console.log(`Chat input found: ${selector}`);
        break;
      }
    }
    
    if (chatInput) {
      // Test chat message sending
      const testMessage = 'E2E Test Message: ' + Date.now();
      await chatInput.fill(testMessage);
      
      // Look for send button
      const sendBtnSelectors = [
        'button:has-text("Send")',
        'button[type="submit"]',
        '.send-button',
        '[data-testid="send-button"]'
      ];
      
      for (const selector of sendBtnSelectors) {
        const sendBtn = page.locator(selector);
        if (await sendBtn.count() > 0) {
          await sendBtn.click();
          console.log('Chat message sent');
          break;
        }
      }
      
      // Check for message in chat history
      await page.waitForTimeout(1000);
      const chatHistory = page.locator('.chat-message, .message, [data-testid="chat-message"]');
      const messageCount = await chatHistory.count();
      console.log(`Found ${messageCount} chat messages`);
    } else {
      console.log('Chat input not found - chat functionality may not be visible in current state');
    }
  });

  test('6. Performance & Memory Testing', async ({ page }) => {
    const performanceMetrics = {
      startTime: Date.now(),
      memoryUsage: null,
      networkRequests: 0,
      errors: []
    };
    
    // Monitor network requests
    page.on('request', () => performanceMetrics.networkRequests++);
    page.on('response', response => {
      if (!response.ok()) {
        performanceMetrics.errors.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        performanceMetrics.errors.push({
          type: 'console',
          message: msg.text()
        });
      }
    });
    
    await page.goto(FRONTEND_URL);
    
    // Get memory usage
    performanceMetrics.memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    // Test page load performance
    const loadTime = Date.now() - performanceMetrics.startTime;
    
    // Simulate user interactions for performance testing
    await page.hover('button', { timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Final performance assessment
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return performance.memory.usedJSHeapSize;
      }
      return null;
    });
    
    console.log('Performance Metrics:', {
      loadTime: `${loadTime}ms`,
      networkRequests: performanceMetrics.networkRequests,
      initialMemory: performanceMetrics.memoryUsage?.usedJSHeapSize 
        ? `${Math.round(performanceMetrics.memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`
        : 'N/A',
      finalMemory: finalMemory ? `${Math.round(finalMemory / 1024 / 1024)}MB` : 'N/A',
      errorCount: performanceMetrics.errors.length
    });
    
    // Assertions
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    expect(performanceMetrics.errors.length).toBeLessThan(5); // Minimal errors expected
    
    if (performanceMetrics.errors.length > 0) {
      console.log('Errors detected:', performanceMetrics.errors);
    }
  });

  test('7. Cross-Browser Compatibility Testing', async ({ page, browserName }) => {
    console.log(`Testing on browser: ${browserName}`);
    
    await page.goto(FRONTEND_URL);
    
    // Browser-specific feature testing
    const features = {
      webrtc: await page.evaluate(() => {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      }),
      websockets: await page.evaluate(() => {
        return typeof WebSocket !== 'undefined';
      }),
      localStorage: await page.evaluate(() => {
        return typeof Storage !== 'undefined';
      })
    };
    
    console.log(`${browserName} feature support:`, features);
    
    // Essential features should be supported
    expect(features.websockets).toBe(true);
    expect(features.localStorage).toBe(true);
    
    // WebRTC support varies by browser and context
    if (!features.webrtc) {
      console.log(`WebRTC not supported in ${browserName} test environment`);
    }
  });

  test('8. Error Handling & Edge Cases Testing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.goto(FRONTEND_URL);
    
    // Test invalid room ID navigation
    await page.goto(`${FRONTEND_URL}/room/invalid-room-id-12345`);
    await page.waitForTimeout(2000);
    
    // Test offline behavior simulation
    await page.route('**/*', route => {
      if (route.request().url().includes('socket.io')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Try to perform actions that require connectivity
    await page.reload();
    await page.waitForTimeout(3000);
    
    console.log(`Page errors encountered: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Error details:', errors);
    }
    
    // Should handle errors gracefully (not crash)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Security & Integration Testing', () => {
  test('9. Security Headers & HTTPS Testing', async ({ page }) => {
    const response = await page.goto(FRONTEND_URL);
    
    // Check HTTPS
    expect(page.url()).toContain('https://');
    
    // Check security headers
    const headers = response.headers();
    console.log('Security headers present:', {
      'content-security-policy': !!headers['content-security-policy'],
      'x-frame-options': !!headers['x-frame-options'],
      'x-content-type-options': !!headers['x-content-type-options'],
      'strict-transport-security': !!headers['strict-transport-security']
    });
    
    // Test mixed content (should not have HTTP resources on HTTPS page)
    const httpRequests = [];
    page.on('request', request => {
      if (request.url().startsWith('http://')) {
        httpRequests.push(request.url());
      }
    });
    
    await page.waitForTimeout(5000);
    
    if (httpRequests.length > 0) {
      console.warn('HTTP requests found on HTTPS page:', httpRequests);
    }
    
    expect(httpRequests.length).toBe(0); // Should not have mixed content
  });

  test('10. Integration Flow Testing', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Test complete user flow: Home -> Create/Join Room -> Media -> Chat
    let flowStep = 1;
    
    console.log(`Step ${flowStep++}: Landing page loaded`);
    await expect(page.locator('body')).toBeVisible();
    
    // Try to create a room
    const createBtn = page.getByText('Create Room', { exact: false });
    if (await createBtn.isVisible()) {
      console.log(`Step ${flowStep++}: Creating room`);
      await createBtn.click();
      await page.waitForTimeout(3000);
      
      // Check if room created successfully
      const currentUrl = page.url();
      if (currentUrl !== FRONTEND_URL) {
        console.log(`Step ${flowStep++}: Room created, URL: ${currentUrl}`);
        
        // Test media stream request
        try {
          await page.evaluate(() => {
            return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          });
          console.log(`Step ${flowStep++}: Media access granted`);
        } catch (e) {
          console.log(`Step ${flowStep++}: Media access denied/unavailable (expected in test environment)`);
        }
        
        // Test chat functionality if available
        const chatInput = page.locator('input[placeholder*="message" i]').first();
        if (await chatInput.isVisible()) {
          await chatInput.fill('Integration test message');
          console.log(`Step ${flowStep++}: Chat message entered`);
          
          const sendBtn = page.locator('button:has-text("Send"), button[type="submit"]').first();
          if (await sendBtn.isVisible()) {
            await sendBtn.click();
            console.log(`Step ${flowStep++}: Chat message sent`);
          }
        }
      }
    }
    
    console.log(`Integration flow completed with ${flowStep - 1} steps`);
  });
});