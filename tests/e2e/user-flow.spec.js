import { test, expect } from '@playwright/test';

test.describe('Video Chat User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('create and join room', async ({ page, context }) => {
    const roomPage = await context.newPage();
    
    // Create room
    await page.click('button:has-text("Create Room")');
    const roomLink = await page.textContent('.room-link');
    
    // Join room in another page
    await roomPage.goto(roomLink);
    
    // Verify room joined
    await expect(roomPage.locator('.peer-connection')).toBeVisible();
  });

  test('screen sharing functionality', async ({ page }) => {
    await page.click('button:has-text("Start Screen Share")');
    
    const screenShareIndicator = page.locator('.screen-share-active');
    await expect(screenShareIndicator).toBeVisible();
  });

  test('chat message sending', async ({ page }) => {
    await page.fill('input[placeholder="Type a message"]', 'Hello, test!');
    await page.click('button:has-text("Send")');
    
    const messageElement = page.locator('.chat-message');
    await expect(messageElement).toContainText('Hello, test!');
  });
});