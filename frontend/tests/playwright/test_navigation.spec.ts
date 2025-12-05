import { test, expect } from '@playwright/test';
import { navigateTo, waitForNavigation, verifyBreadcrumbs } from './utils/test-helpers';

/**
 * Tests for application navigation, including:
 * - Route navigation
 * - PhoenixNavBar functionality
 * - Breadcrumbs
 * - Collapsible sidebar
 */

test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('/');
    // Wait for the app to fully load
    await waitForNavigation(page);
  });

  test('navigates through main routes via navbar', async ({ page }) => {
    // Get all navigation links in the PhoenixNavBar
    const navLinks = page.locator('.phoenix-nav-bar a');
    const count = await navLinks.count();
    
    // Store the routes we've visited to verify navigation
    const visitedRoutes = new Set<string>();
    visitedRoutes.add('/'); // Starting point
    
    // Click each navigation link and verify navigation
    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      const href = await link.getAttribute('href');
      
      // Skip external links and already visited routes
      if (!href || href.startsWith('http') || visitedRoutes.has(href)) {
        continue;
      }
      
      // Click the link
      await link.click();
      await waitForNavigation(page);
      
      // Verify URL changed
      const currentUrl = page.url();
      expect(currentUrl).toContain(href);
      
      // Add to visited routes
      visitedRoutes.add(href);
      
      // Return to home for next iteration
      await page.goto('/');
      await waitForNavigation(page);
    }
    
    // Verify we've visited at least some routes
    expect(visitedRoutes.size).toBeGreaterThan(1);
  });

  test('breadcrumbs update correctly when navigating', async ({ page }) => {
    // Navigate to a nested route
    await navigateTo(page, 'settings');
    await waitForNavigation(page);
    
    // Verify breadcrumbs show correct path
    await verifyBreadcrumbs(page, 'Home > Settings');
    
    // Navigate deeper if possible (e.g., to a subsection)
    const subLinks = page.locator('.settings-menu a').first();
    if (await subLinks.count() > 0) {
      await subLinks.click();
      await waitForNavigation(page);
      
      // Verify breadcrumbs update to show deeper path
      const breadcrumbText = await page.locator('.breadcrumbs').textContent();
      expect(breadcrumbText).toContain('Home > Settings >');
    }
  });

  test('sidebar collapses and expands correctly', async ({ page }) => {
    // Locate the sidebar
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    
    // Find and click the collapse toggle
    const collapseToggle = page.locator('.sidebar-toggle');
    await collapseToggle.click();
    
    // Verify sidebar is collapsed (width reduced or class changed)
    await expect(sidebar).toHaveClass(/collapsed/);
    
    // Expand the sidebar again
    await collapseToggle.click();
    
    // Verify sidebar is expanded
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('navigation is responsive across different viewports', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await waitForNavigation(page);
    
    // On mobile, typically a hamburger menu is visible and sidebar is hidden
    const hamburgerMenu = page.locator('.mobile-menu-toggle');
    await expect(hamburgerMenu).toBeVisible();
    
    // Open mobile menu
    await hamburgerMenu.click();
    
    // Verify mobile navigation menu appears
    const mobileNav = page.locator('.mobile-nav-menu');
    await expect(mobileNav).toBeVisible();
    
    // Test navigation works on mobile
    const mobileNavLinks = mobileNav.locator('a').first();
    if (await mobileNavLinks.count() > 0) {
      const href = await mobileNavLinks.getAttribute('href');
      await mobileNavLinks.click();
      await waitForNavigation(page);
      
      // Verify navigation worked
      const currentUrl = page.url();
      expect(currentUrl).toContain(href);
    }
    
    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('direct URL navigation works for all routes', async ({ page }) => {
    // List of major routes to test
    const routes = ['/', '/settings', '/profile', '/help'];
    
    // Navigate to each route directly
    for (const route of routes) {
      await page.goto(route);
      await waitForNavigation(page);
      
      // Verify the page loaded successfully
      expect(page.url()).toContain(route);
      
      // Check for 404 indicators
      const notFoundElement = page.locator('text="Not Found"');
      const notFoundCount = await notFoundElement.count();
      expect(notFoundCount).toBe(0);
    }
  });

  test('back/forward browser navigation works', async ({ page }) => {
    // Navigate to first page
    await navigateTo(page, '');
    await waitForNavigation(page);
    
    // Navigate to second page
    await navigateTo(page, 'settings');
    await waitForNavigation(page);
    
    // Navigate to third page
    await navigateTo(page, 'profile');
    await waitForNavigation(page);
    
    // Go back twice
    await page.goBack();
    await waitForNavigation(page);
    expect(page.url()).toContain('/settings');
    
    await page.goBack();
    await waitForNavigation(page);
    expect(page.url()).toContain('/');
    
    // Go forward twice
    await page.goForward();
    await waitForNavigation(page);
    expect(page.url()).toContain('/settings');
    
    await page.goForward();
    await waitForNavigation(page);
    expect(page.url()).toContain('/profile');
  });
});