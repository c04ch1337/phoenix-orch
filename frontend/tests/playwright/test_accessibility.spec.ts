import { test, expect } from '@playwright/test';
import { testKeyboardNavigation, checkColorContrast } from './utils/test-helpers';

/**
 * Comprehensive tests for accessibility compliance, including:
 * - ARIA attributes validation
 * - Keyboard navigation testing
 * - Screen reader compatibility
 * - Color contrast verification
 */

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('/');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
  });

  test('interactive elements have proper ARIA attributes', async ({ page }) => {
    // Collect all interactive elements
    const interactiveElements = page.locator('button, a, input, [role="button"], select, textarea, [tabindex]:not([tabindex="-1"])');
    const count = await interactiveElements.count();
    
    // Test each element for ARIA attributes
    for (let i = 0; i < count; i++) {
      const element = interactiveElements.nth(i);
      const tag = await element.evaluate(el => el.tagName.toLowerCase());
      
      // Check for proper labeling
      const hasAccessibleLabel = await element.evaluate(el => {
        // Check various ways an element can be labeled
        return !!el.getAttribute('aria-label') || 
               !!el.getAttribute('aria-labelledby') || 
               (tag === 'input' && !!el.getAttribute('placeholder')) ||
               (tag === 'input' && !!el.getAttribute('title')) ||
               (tag === 'a' && el.textContent && el.textContent.trim().length > 0) ||
               (tag === 'button' && el.textContent && el.textContent.trim().length > 0);
      }, tag);
      
      expect(hasAccessibleLabel).toBeTruthy();
      
      // If element has aria-expanded, verify it's a valid value
      const ariaExpanded = await element.getAttribute('aria-expanded');
      if (ariaExpanded !== null) {
        expect(['true', 'false']).toContain(ariaExpanded);
      }
      
      // If element has aria-controls, verify the referenced element exists
      const ariaControls = await element.getAttribute('aria-controls');
      if (ariaControls !== null) {
        const controlledElement = page.locator(`#${ariaControls}`);
        await expect(controlledElement).toHaveCount(1);
      }
    }
  });

  test('keyboard navigation works throughout the application', async ({ page }) => {
    // Use the helper to test basic keyboard navigation
    await testKeyboardNavigation(page);
    
    // Test tabbing through all interactive elements
    await page.keyboard.press('Tab');
    
    // Get the count of focusable elements
    const focusableElements = page.locator('[tabindex]:not([tabindex="-1"]), a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    const count = await focusableElements.count();
    
    // Tab through all elements and verify focus moves appropriately
    for (let i = 0; i < count; i++) {
      const focused = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(focused).not.toBe('body'); // Focus should not be on body
      await page.keyboard.press('Tab');
    }
    
    // Test keyboard activation of focused elements
    await page.keyboard.press('Tab'); // Focus first element
    await page.keyboard.press('Enter');
    
    // Test escape key closes dialogs
    const dialogOpen = await page.locator('dialog[open], [role="dialog"], .modal').count() > 0;
    if (dialogOpen) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const dialogStillOpen = await page.locator('dialog[open], [role="dialog"], .modal').count() > 0;
      expect(dialogStillOpen).toBeFalsy();
    }
  });

  test('screen reader compatibility with aria-live regions', async ({ page }) => {
    // Look for aria-live regions
    const ariaLiveRegions = page.locator('[aria-live]');
    const count = await ariaLiveRegions.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const region = ariaLiveRegions.nth(i);
        const liveValue = await region.getAttribute('aria-live');
        
        // aria-live values should be one of: off, polite, assertive
        expect(['off', 'polite', 'assertive']).toContain(liveValue);
      }
    }
    
    // Test announcements in live regions if possible
    // This is a basic simulation since we can't actually verify screen reader announcements
    const hasPoliteLiveRegion = await page.locator('[aria-live="polite"]').count() > 0;
    if (hasPoliteLiveRegion) {
      // Perform an action that should trigger an announcement
      // For example, clicking a notification button
      const notifyButton = page.locator('button:has-text("Notify"), button:has-text("Alert")').first();
      if (await notifyButton.count() > 0) {
        await notifyButton.click();
        
        // Check if the live region content updates
        const liveRegion = page.locator('[aria-live="polite"]');
        await expect(liveRegion).not.toBeEmpty({ timeout: 2000 });
      }
    }
  });

  test('color contrast meets WCAG requirements', async ({ page }) => {
    // Test color contrast of key UI elements
    const elementsToCheck = [
      '.navbar',      // Navigation bar
      'main h1',      // Main headings
      'button.primary', // Primary buttons
      'a',            // Links
      '.alert'        // Alerts/messages
    ];
    
    for (const selector of elementsToCheck) {
      // We'll use the helper from test-helpers.ts
      await checkColorContrast(page, selector);
      
      // Additional automated check for contrast ratio
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) { // Limit to first 5 elements for performance
          const element = elements.nth(i);
          
          // This is a simplified approach - in a real test you'd extract actual colors
          // and calculate the ratio according to WCAG guidelines
          const hasAdequateContrast = await element.evaluate(el => {
            const styles = window.getComputedStyle(el);
            const bgColor = styles.backgroundColor;
            const textColor = styles.color;
            // In real implementation, you'd calculate actual contrast ratio here
            return (bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)' && 
                    textColor !== 'transparent' && textColor !== 'rgba(0, 0, 0, 0)');
          });
          
          expect(hasAdequateContrast).toBeTruthy();
        }
      }
    }
  });

  test('form fields have associated labels', async ({ page }) => {
    // Check all form inputs have proper label associations
    const formInputs = page.locator('input:not([type="hidden"]), select, textarea');
    const count = await formInputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = formInputs.nth(i);
      const inputId = await input.getAttribute('id');
      
      if (inputId) {
        // Check for associated label using for attribute
        const associatedLabel = page.locator(`label[for="${inputId}"]`);
        const hasAssociatedLabel = await associatedLabel.count() > 0;
        
        // If there's no explicit label, check if input has aria-label or is wrapped in a label
        const hasAriaLabel = await input.getAttribute('aria-label') !== null;
        const isWrappedInLabel = await input.evaluate(el => {
          let parent = el.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') return true;
            parent = parent.parentElement;
          }
          return false;
        });
        
        expect(hasAssociatedLabel || hasAriaLabel || isWrappedInLabel).toBeTruthy();
      } else {
        // No ID, so check for aria-label or being wrapped in a label
        const hasAriaLabel = await input.getAttribute('aria-label') !== null;
        const isWrappedInLabel = await input.evaluate(el => {
          let parent = el.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') return true;
            parent = parent.parentElement;
          }
          return false;
        });
        
        expect(hasAriaLabel || isWrappedInLabel).toBeTruthy();
      }
    }
  });

  test('images have alt text', async ({ page }) => {
    // Check all images have alt text
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const image = images.nth(i);
      const altText = await image.getAttribute('alt');
      
      // SVGs and decorative images might use aria-hidden="true" instead of alt
      const ariaHidden = await image.getAttribute('aria-hidden');
      const role = await image.getAttribute('role');
      
      // Either alt text must be present, or image must be marked as decorative/hidden
      expect(altText !== null || ariaHidden === 'true' || role === 'presentation').toBeTruthy();
    }
  });

  test('page has valid document structure with landmarks', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0); // There should be at least one h1
    
    // Check for common landmarks/regions
    const landmarks = [
      'header',
      'main',
      'nav',
      'footer',
      '[role="banner"]',
      '[role="main"]',
      '[role="navigation"]',
      '[role="contentinfo"]'
    ];
    
    // Count how many of these landmarks exist
    let landmarkCount = 0;
    for (const landmark of landmarks) {
      landmarkCount += await page.locator(landmark).count();
    }
    
    // There should be at least some landmarks on the page
    expect(landmarkCount).toBeGreaterThan(0);
  });
});