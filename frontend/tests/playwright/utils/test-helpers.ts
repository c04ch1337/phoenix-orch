import { Page, expect, Locator } from '@playwright/test';

/**
 * Helper functions for Playwright tests
 */

/**
 * Login to the application
 * @param page - Playwright page
 */
export async function login(page: Page): Promise<void> {
  // Implement based on your actual login flow
  await page.goto('/');
  // Add login steps if needed
}

/**
 * Navigate to a specific route
 * @param page - Playwright page
 * @param route - Route to navigate to
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  await page.goto(`/${route}`);
}

/**
 * Wait for navigation to complete
 * @param page - Playwright page
 */
export async function waitForNavigation(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Check if breadcrumbs show the correct path
 * @param page - Playwright page
 * @param expectedPath - Expected path in breadcrumbs
 */
export async function verifyBreadcrumbs(page: Page, expectedPath: string): Promise<void> {
  const breadcrumbs = page.locator('.breadcrumbs');
  await expect(breadcrumbs).toContainText(expectedPath);
}

/**
 * Press a keyboard shortcut
 * @param page - Playwright page
 * @param keys - Array of keys to press (e.g., ['Control', '1'])
 */
export async function pressShortcut(page: Page, keys: string[]): Promise<void> {
  for (const key of keys.slice(0, -1)) {
    await page.keyboard.down(key);
  }
  await page.keyboard.press(keys[keys.length - 1]);
  for (const key of keys.slice(0, -1).reverse()) {
    await page.keyboard.up(key);
  }
}

/**
 * Test accessibility of a page
 * @param page - Playwright page
 */
export async function testAccessibility(page: Page): Promise<void> {
  // Check for basic accessibility features
  const interactiveElements = page.locator('button, a, input, [role="button"]');
  const count = await interactiveElements.count();
  
  for (let i = 0; i < count; i++) {
    const element = interactiveElements.nth(i);
    await expect(element).toBeVisible();
    
    // Check for ARIA attributes or accessible name
    const hasAriaLabel = await element.evaluate((el) => {
      return el.hasAttribute('aria-label') ||
             el.hasAttribute('aria-labelledby') ||
             el.hasAttribute('alt') ||
             (el.textContent ? el.textContent.trim().length > 0 : false);
    });
    
    expect(hasAriaLabel).toBeTruthy();
  }
}

/**
 * Verify keyboard navigation works
 * @param page - Playwright page
 */
export async function testKeyboardNavigation(page: Page): Promise<void> {
  // Navigate through focusable elements
  await page.keyboard.press('Tab');
  
  // Check if focus is visible
  const focusedElement = await page.evaluate(() => {
    const activeElement = document.activeElement;
    const rect = activeElement?.getBoundingClientRect();
    return {
      tag: activeElement?.tagName.toLowerCase(),
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
    };
  });
  
  expect(focusedElement.tag).toBeDefined();
  expect(focusedElement.rect).toBeDefined();
}

/**
 * Check color contrast ratio for accessibility
 * This is a simplified version; in real tests you might use a specific library
 * @param page - Playwright page
 * @param selector - Element selector
 */
export async function checkColorContrast(page: Page, selector: string): Promise<void> {
  // This is a placeholder for a more complex implementation
  // In a real implementation, you would extract foreground and background colors
  // and calculate the contrast ratio according to WCAG guidelines
  await page.locator(selector).isVisible();
}

/**
 * Helper to test splash screen functionality
 * @param page - Playwright page
 * @param durationMs - Expected duration in milliseconds
 */
export async function testSplashScreen(page: Page, durationMs: number): Promise<void> {
  // Navigate to the application
  await page.goto('/');
  
  // Check that splash screen is visible
  const splashScreen = page.locator('.splash-screen');
  await expect(splashScreen).toBeVisible();
  
  // Measure the time until splash screen disappears
  const startTime = Date.now();
  await expect(splashScreen).toBeHidden({ timeout: durationMs + 1000 });
  const endTime = Date.now();
  
  // Verify the duration is close to expected (with some tolerance)
  const actualDuration = endTime - startTime;
  expect(actualDuration).toBeGreaterThanOrEqual(durationMs - 200);
  expect(actualDuration).toBeLessThanOrEqual(durationMs + 200);
}

/**
 * Test responsive behavior across different viewport sizes
 * @param page - Playwright page
 * @param viewports - Array of viewport sizes to test
 */
export async function testResponsiveness(page: Page, viewports: Array<{width: number, height: number}>): Promise<void> {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500); // Allow time for responsive changes
    
    // Add specific checks for your UI at different viewport sizes
    const navBar = page.locator('.navbar');
    await expect(navBar).toBeVisible();
  }
}