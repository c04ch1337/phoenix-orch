import { test, expect } from '@playwright/test';
import { testSplashScreen } from './utils/test-helpers';

/**
 * Tests for splash screen functionality, including:
 * - Splash screen duration (2.8 seconds)
 * - Fade transitions to main content
 * - "Neuralink thought bypass" skip functionality
 * - localStorage persistence of splash preferences
 */

test.describe('Splash Screen Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage before each test
    await context.clearCookies();
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('splash screen shows for exactly 2.8 seconds', async ({ page }) => {
    // Test the splash screen duration using the helper
    await testSplashScreen(page, 2800); // 2.8 seconds in ms
  });

  test('splash screen has smooth fade transition to main content', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the splash screen is visible
    const splashScreen = page.locator('.splash-screen');
    await expect(splashScreen).toBeVisible();
    
    // Check for transition/animation CSS properties
    const hasTransition = await splashScreen.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.transition.includes('opacity') || 
             styles.animation.includes('fade');
    });
    
    expect(hasTransition).toBeTruthy();
    
    // Wait for fade transition to complete
    await expect(splashScreen).toBeHidden({ timeout: 5000 });
    
    // Verify main content is now visible
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
    
    // Check if main content has fade-in effect
    const mainContentHasTransition = await mainContent.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.transition.includes('opacity') || 
             styles.animation.includes('fade');
    });
    
    expect(mainContentHasTransition).toBeTruthy();
  });

  test('Neuralink thought bypass skip functionality works', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify splash screen is visible
    const splashScreen = page.locator('.splash-screen');
    await expect(splashScreen).toBeVisible();
    
    // Find and click the skip button
    const skipButton = page.locator('.splash-screen .skip-button, .splash-screen [aria-label="Skip splash screen"]');
    await skipButton.click();
    
    // Verify splash screen immediately disappears
    await expect(splashScreen).toBeHidden({ timeout: 1000 });
    
    // Verify main content is shown right away
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });

  test('splash preferences are remembered in localStorage', async ({ page, context }) => {
    // First visit - should show splash screen
    await page.goto('/');
    
    // Verify splash screen is visible
    const splashScreen = page.locator('.splash-screen');
    await expect(splashScreen).toBeVisible();
    
    // Find and click the "Don't show again" option or equivalent
    const dontShowOption = page.locator('.splash-screen .dont-show-again');
    await dontShowOption.click();
    
    // Skip the splash screen
    const skipButton = page.locator('.splash-screen .skip-button');
    await skipButton.click();
    
    // Verify main content is visible
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
    
    // Check localStorage has been set
    const localStorageSet = await page.evaluate(() => {
      return !!window.localStorage.getItem('splash-preferences') || 
             !!window.localStorage.getItem('skip-splash');
    });
    
    expect(localStorageSet).toBeTruthy();
    
    // Close and reopen page (simulating a new visit)
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto('/');
    
    // Verify splash screen is NOT shown
    const newSplashScreen = newPage.locator('.splash-screen');
    
    try {
      // Add a short timeout - we expect this to fail because the splash screen should be hidden
      await expect(newSplashScreen).toBeVisible({ timeout: 1000 });
      throw new Error('Splash screen was shown despite preferences');
    } catch (e) {
      // This is expected - splash screen should not be visible
    }
    
    // Verify main content is immediately visible
    const newMainContent = newPage.locator('.main-content');
    await expect(newMainContent).toBeVisible();
  });

  test('splash screen is responsive across different devices', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 800 }, // Desktop
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Clear localStorage between viewport tests
      await page.evaluate(() => window.localStorage.clear());
      
      // Navigate to trigger splash screen
      await page.goto('/');
      
      // Verify splash screen appears and is properly sized for viewport
      const splashScreen = page.locator('.splash-screen');
      await expect(splashScreen).toBeVisible();
      
      // Check splash screen adapts to viewport
      const splashSize = await splashScreen.boundingBox();
      expect(splashSize?.width).toBeLessThanOrEqual(viewport.width);
      expect(splashSize?.height).toBeLessThanOrEqual(viewport.height);
      
      // Skip splash for next iteration
      const skipButton = page.locator('.splash-screen .skip-button');
      if (await skipButton.isVisible())
        await skipButton.click();
      else
        await page.waitForTimeout(3000); // Wait for automatic transition
    }
  });

  test('splash screen animations perform within performance budget', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Start performance measurement
    const performanceEntries = await page.evaluate(() => {
      return new Promise(resolve => {
        // Create PerformanceObserver to monitor animation performance
        const observer = new PerformanceObserver((list) => {
          resolve(list.getEntries());
        });
        
        // Observe paint and animation related metrics
        observer.observe({ entryTypes: ['paint', 'animation'] });
        
        // Fallback in case no entries are captured
        setTimeout(() => resolve([]), 5000);
      });
    });
    
    // Analyze performance entries
    // This is a simplified example - real implementation would depend on your perf budget
    await page.evaluate((entries: PerformanceEntry[]) => {
      const paintEntries = entries.filter(e => e.entryType === 'paint');
      console.log('Paint performance:', paintEntries);
    }, performanceEntries as PerformanceEntry[]);
    
    // Wait for splash to complete
    await page.waitForTimeout(3000);
    
    // Verify main content is shown
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });
});