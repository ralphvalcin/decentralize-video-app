import { test, expect } from '@playwright/test';

test.describe('Video Call Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('create a new room and join', async ({ page, browser }) => {
    // Create first room
    await page.click('[data-testid="create-room"]');
    const roomUrl = await page.textContent('[data-testid="room-link"]');
    
    // Open a new page and join the room
    const newPage = await browser.newPage();
    await newPage.goto(roomUrl);

    // Check video grid and participants
    const firstPageVideoGrid = await page.locator('[data-testid="video-grid"]');
    const secondPageVideoGrid = await newPage.locator('[data-testid="video-grid"]');

    expect(await firstPageVideoGrid.count()).toBe(1);
    expect(await secondPageVideoGrid.count()).toBe(1);
  });

  test('toggle audio and video', async ({ page }) => {
    await page.click('[data-testid="create-room"]');

    const audioToggle = page.locator('[data-testid="audio-toggle"]');
    const videoToggle = page.locator('[data-testid="video-toggle"]');

    // Toggle audio
    await audioToggle.click();
    expect(await audioToggle.getAttribute('aria-pressed')).toBe('false');

    // Toggle video
    await videoToggle.click();
    expect(await videoToggle.getAttribute('aria-pressed')).toBe('false');
  });

  test('send chat message in room', async ({ page }) => {
    await page.click('[data-testid="create-room"]');

    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatSend = page.locator('[data-testid="chat-send"]');
    const chatMessages = page.locator('[data-testid="chat-messages"]');

    await chatInput.fill('Hello, this is a test message');
    await chatSend.click();

    const lastMessage = await chatMessages.locator('li').last();
    expect(await lastMessage.textContent()).toContain('Hello, this is a test message');
  });
});