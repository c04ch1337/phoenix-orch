import { test, expect } from '@playwright/test';

test.describe('ChatWindow Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page containing the chat window
    await page.goto('/');
  });

  test('sends and receives messages across browsers', async ({ page }) => {
    // Wait for chat input to be available
    const chatInput = await page.getByPlaceholder('Command The Ashen Guard via Phoenix ORCH...');
    await expect(chatInput).toBeVisible();

    // Type and send a message
    await chatInput.type('Hello Phoenix');
    await page.getByRole('button').click();

    // Verify message appears in chat
    await expect(page.getByText('Hello Phoenix')).toBeVisible();
    await expect(page.getByText('DAD')).toBeVisible();

    // Verify message styling
    const userMessage = await page.locator('.bg-zinc-800').first();
    await expect(userMessage).toBeVisible();
    await expect(userMessage).toHaveClass(/bg-zinc-800/);
  });

  test('shows typing indicator', async ({ page }) => {
    // Trigger typing indicator (this would need to be coordinated with your app's state management)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('phoenix-typing', { detail: { isTyping: true } }));
    });

    // Verify typing indicator appears
    const typingIndicator = await page.locator('.animate-bounce').first();
    await expect(typingIndicator).toBeVisible();
  });

  test('handles long messages and scrolling', async ({ page }) => {
    const chatInput = await page.getByPlaceholder('Command The Ashen Guard via Phoenix ORCH...');
    
    // Send a long message
    const longMessage = 'A'.repeat(500);
    await chatInput.type(longMessage);
    await page.getByRole('button').click();

    // Verify message appears and container scrolls
    const messageContainer = await page.locator('.overflow-y-auto').first();
    const scrollHeight = await messageContainer.evaluate(node => node.scrollHeight);
    const clientHeight = await messageContainer.evaluate(node => node.clientHeight);
    
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('validates input constraints', async ({ page }) => {
    const chatInput = await page.getByPlaceholder('Command The Ashen Guard via Phoenix ORCH...');
    const sendButton = page.getByRole('button');

    // Empty message
    await chatInput.type('   ');
    await expect(sendButton).toBeDisabled();

    // Valid message
    await chatInput.clear();
    await chatInput.type('Valid message');
    await expect(sendButton).toBeEnabled();
  });

  test('maintains visual consistency across viewport sizes', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 800 }, // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Verify chat container remains properly styled
      const chatContainer = await page.locator('.flex.flex-col.h-full').first();
      await expect(chatContainer).toBeVisible();
      
      // Verify input area remains fixed at bottom
      const inputArea = await page.locator('.border-t.border-red-700').first();
      const inputBox = await page.getByPlaceholder('Command The Ashen Guard via Phoenix ORCH...');
      
      await expect(inputArea).toBeVisible();
      await expect(inputBox).toBeVisible();
      
      // Take screenshot for visual comparison
      await page.screenshot({
        path: `test-results/chat-viewport-${viewport.width}x${viewport.height}.png`
      });
    }
  });

  test('handles network conditions', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });

    const chatInput = await page.getByPlaceholder('Command The Ashen Guard via Phoenix ORCH...');
    await chatInput.type('Test message with delay');
    await page.getByRole('button').click();

    // Verify message appears despite network delay
    await expect(page.getByText('Test message with delay')).toBeVisible();
  });

  test('maintains accessibility standards', async ({ page }) => {
    // Check for ARIA labels and roles
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', /Command The Ashen Guard/);
    await expect(page.getByRole('button')).toBeVisible();

    // Verify keyboard navigation
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(focused).toBe('input');

    // Run accessibility audit
    await page.evaluate(async () => {
      const { axe } = await import('@axe-core/playwright');
      const results = await axe(document.body);
      expect(results.violations).toHaveLength(0);
    });
  });
});