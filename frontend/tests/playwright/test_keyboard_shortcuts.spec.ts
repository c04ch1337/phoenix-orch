import { test, expect } from '@playwright/test';
import { navigateTo, waitForNavigation, pressShortcut } from './utils/test-helpers';

/**
 * Tests for keyboard shortcuts functionality, including:
 * - Navigation shortcuts (Ctrl+1, Ctrl+2, Ctrl+3, Ctrl+`)
 * - Command palette shortcuts (Ctrl+/, Ctrl+K)
 * - Browser history navigation (Alt+← / Alt+→)
 */

test.describe('Keyboard Shortcuts Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('/');
    // Wait for the app to fully load
    await waitForNavigation(page);
  });

  test('Ctrl+1, Ctrl+2, Ctrl+3 navigate to main sections', async ({ page }) => {
    // Test Ctrl+1 (typically navigates to Home/Dashboard)
    await pressShortcut(page, ['Control', '1']);
    await waitForNavigation(page);
    
    // Verify we're on the home/dashboard page
    expect(page.url()).toContain('/');
    
    // Test Ctrl+2 (typically navigates to Settings or second main section)
    await pressShortcut(page, ['Control', '2']);
    await waitForNavigation(page);
    
    // Verify navigation worked
    // This will need to be updated based on your app's actual routes
    expect(page.url()).not.toContain('/');
    
    // Test Ctrl+3 (typically navigates to third main section)
    await pressShortcut(page, ['Control', '3']);
    await waitForNavigation(page);
    
    // Verify navigation to third section
    expect(page.url()).not.toContain('/');
  });

  test('Ctrl+` toggles developer console', async ({ page }) => {
    // Press Ctrl+` to open developer console
    await pressShortcut(page, ['Control', '`']);
    
    // Check if developer console appears
    const devConsole = page.locator('.dev-console');
    await expect(devConsole).toBeVisible();
    
    // Press Ctrl+` again to close it
    await pressShortcut(page, ['Control', '`']);
    
    // Verify console is hidden
    await expect(devConsole).toBeHidden();
  });

  test('Ctrl+/ opens help or search', async ({ page }) => {
    // Press Ctrl+/ to open help/search
    await pressShortcut(page, ['Control', '/']);
    
    // Check if help/search dialog appears
    const helpDialog = page.locator('.help-dialog, .search-dialog');
    await expect(helpDialog).toBeVisible();
    
    // Close the dialog (typically with Escape)
    await page.keyboard.press('Escape');
    
    // Verify dialog is closed
    await expect(helpDialog).toBeHidden();
  });

  test('Ctrl+K opens command palette', async ({ page }) => {
    // Press Ctrl+K to open command palette
    await pressShortcut(page, ['Control', 'k']);
    
    // Check if command palette appears
    const commandPalette = page.locator('.command-palette');
    await expect(commandPalette).toBeVisible();
    
    // Type a command to test functionality
    await page.keyboard.type('help');
    
    // Verify command filtering works
    const filteredCommands = commandPalette.locator('.command-item:visible');
    const count = await filteredCommands.count();
    expect(count).toBeGreaterThan(0);
    
    // Close the command palette with Escape
    await page.keyboard.press('Escape');
    
    // Verify palette is closed
    await expect(commandPalette).toBeHidden();
  });

  test('Alt+Left/Right navigate browser history', async ({ page }) => {
    // Navigate to first page
    await navigateTo(page, '');
    await waitForNavigation(page);
    
    // Navigate to second page
    await navigateTo(page, 'settings');
    await waitForNavigation(page);
    
    // Navigate to third page
    await navigateTo(page, 'profile');
    await waitForNavigation(page);
    
    // Use Alt+Left to go back
    await pressShortcut(page, ['Alt', 'ArrowLeft']);
    await waitForNavigation(page);
    
    // Verify we navigated back to the previous page
    expect(page.url()).toContain('/settings');
    
    // Go back again
    await pressShortcut(page, ['Alt', 'ArrowLeft']);
    await waitForNavigation(page);
    expect(page.url()).toContain('/');
    
    // Use Alt+Right to go forward
    await pressShortcut(page, ['Alt', 'ArrowRight']);
    await waitForNavigation(page);
    
    // Verify we navigated forward
    expect(page.url()).toContain('/settings');
  });

  test('keyboard shortcuts work across different pages', async ({ page }) => {
    // Navigate to settings
    await navigateTo(page, 'settings');
    await waitForNavigation(page);
    
    // Test Ctrl+K works on settings page
    await pressShortcut(page, ['Control', 'k']);
    const commandPalette = page.locator('.command-palette');
    await expect(commandPalette).toBeVisible();
    
    // Close command palette
    await page.keyboard.press('Escape');
    
    // Navigate to another page
    await navigateTo(page, 'profile');
    await waitForNavigation(page);
    
    // Test Ctrl+/ works on profile page
    await pressShortcut(page, ['Control', '/']);
    const helpDialog = page.locator('.help-dialog, .search-dialog');
    await expect(helpDialog).toBeVisible();
  });

  test('escape key closes all dialogs and overlays', async ({ page }) => {
    // Open command palette
    await pressShortcut(page, ['Control', 'k']);
    const commandPalette = page.locator('.command-palette');
    await expect(commandPalette).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify palette is closed
    await expect(commandPalette).toBeHidden();
    
    // Open help dialog
    await pressShortcut(page, ['Control', '/']);
    const helpDialog = page.locator('.help-dialog, .search-dialog');
    await expect(helpDialog).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify dialog is closed
    await expect(helpDialog).toBeHidden();
  });
  
  test('keyboard shortcuts have visual indicators', async ({ page }) => {
    // Open command palette
    await pressShortcut(page, ['Control', 'k']);
    const commandPalette = page.locator('.command-palette');
    
    // Check if commands in the palette show keyboard shortcut hints
    const shortcutHints = commandPalette.locator('.shortcut-hint');
    const count = await shortcutHints.count();
    
    // There should be at least some shortcut hints visible
    expect(count).toBeGreaterThan(0);
    
    // Close palette
    await page.keyboard.press('Escape');
  });
});