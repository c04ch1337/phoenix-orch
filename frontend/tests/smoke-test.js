/**
 * Phoenix Orch Desktop Frontend - Automated Smoke Test
 * 
 * This script performs a comprehensive smoke test of the Phoenix Orch Desktop
 * frontend, testing each page for loading time, UI interactions, and functionality.
 */

// Import required modules
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

// Get current filename and directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Constants
const CONFIG = {
  baseUrl: 'http://localhost:5000',
  maxLoadTime: 1800, // 1.8 seconds in ms
  screenshotDir: path.join(__dirname, '..', 'test-results', `smoke-test-${new Date().toISOString().replace(/:/g, '-')}`),
  pages: {
    phoenixPrompt: '/',
    cipherGuard: '/cipher',
    emberUnit: '/ember',
    taskManager: '/task-manager',
    fileExplorer: '/file-explorer',
    memoryTheater: '/memory',
    homeOrchestrator: '/home',
    autopilotMaster: '/autopilot',
    neuralinkLive: '/neuralink',
    settings: '/settings'
  },
  // Keyboard shortcuts to test
  keyboardShortcuts: [
    { keys: ['Control', '`'], description: 'Toggle Universal Orchestrator Bar' },
    { keys: ['Control', 'Shift', 'R'], description: 'Refresh Current View' },
    // Add other shortcuts here
  ]
};

// Test Results Storage
const testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: [],
  skippedTests: [],
  screenshots: [],
  startTime: null,
  endTime: null
};

/**
 * Utility Functions
 */

// Create screenshots directory if it doesn't exist
function ensureScreenshotDir() {
  if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
  }
  console.log(`Screenshots will be saved to: ${CONFIG.screenshotDir}`);
}

// Take a screenshot and save it
async function takeScreenshot(page, name) {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  testResults.screenshots.push(filepath);
  console.log(`Screenshot saved: ${filename}`);
  return filepath;
}

// Measure page load time
async function measureLoadTime(page, url) {
  console.log(`Navigating to ${url} and measuring load time...`);
  
  const startTime = performance.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const loadTime = performance.now() - startTime;
  
  console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
  
  // Check if it loaded within our threshold
  const loadTimeVerified = loadTime <= CONFIG.maxLoadTime;
  
  if (!loadTimeVerified) {
    console.error(`❌ Page load time exceeded threshold: ${loadTime.toFixed(2)}ms > ${CONFIG.maxLoadTime}ms`);
    testResults.failedTests.push({
      name: `Load time verification for ${url}`,
      reason: `Page took ${loadTime.toFixed(2)}ms to load, which exceeds the ${CONFIG.maxLoadTime}ms threshold`
    });
  } else {
    console.log(`✅ Page load time within threshold: ${loadTime.toFixed(2)}ms <= ${CONFIG.maxLoadTime}ms`);
    testResults.passedTests++;
  }
  
  testResults.totalTests++;
  return { loadTime, loadTimeVerified };
}

// Find and click all buttons on the page
async function clickAllButtons(page) {
  const buttons = await page.$$('button:visible, [role="button"]:visible');
  console.log(`Found ${buttons.length} buttons to click`);
  
  for (const button of buttons) {
    try {
      // Get button text for logging
      const text = await button.textContent();
      console.log(`Clicking button: ${text.trim()}`);
      
      // Check if the button is non-destructive (avoid clicking logout, delete, etc.)
      const buttonText = (text || '').toLowerCase();
      const isDangerous = buttonText.includes('delete') || 
                          buttonText.includes('remove') || 
                          buttonText.includes('logout');
      
      if (!isDangerous) {
        await button.click();
        await page.waitForTimeout(300); // Give the UI time to respond
      } else {
        console.log(`Skipping potentially destructive button: ${buttonText}`);
      }
    } catch (error) {
      console.error(`Failed to click button: ${error.message}`);
    }
  }
}

// Test all dropdown/context menus
async function testAllDropdowns(page) {
  // Find dropdown triggers (could be buttons or other elements with specific classes)
  const dropdownTriggers = await page.$$(
    '[aria-haspopup="true"], .dropdown-toggle, [role="combobox"]'
  );
  
  console.log(`Found ${dropdownTriggers.length} dropdown/context menus to test`);
  
  for (const trigger of dropdownTriggers) {
    try {
      // Click to open dropdown
      await trigger.click();
      await page.waitForTimeout(300); // Wait for dropdown to appear
      
      // Take screenshot with dropdown open
      await takeScreenshot(page, 'dropdown-open');
      
      // Click again to close (or click elsewhere)
      await page.mouse.click(10, 10); // Click in the corner to close
      await page.waitForTimeout(300); // Wait for dropdown to close
    } catch (error) {
      console.error(`Failed to test dropdown: ${error.message}`);
    }
  }
}

// Type test text into input fields
async function typeIntoInputFields(page) {
  const inputs = await page.$$('input[type="text"]:visible, textarea:visible');
  console.log(`Found ${inputs.length} input fields`);
  
  for (const input of inputs) {
    try {
      await input.click();
      await input.fill('test 123');
      await page.waitForTimeout(200);
    } catch (error) {
      console.error(`Failed to type into input: ${error.message}`);
    }
  }
}

// Test keyboard shortcuts
async function testKeyboardShortcuts(page) {
  for (const shortcut of CONFIG.keyboardShortcuts) {
    console.log(`Testing keyboard shortcut: ${shortcut.description}`);
    try {
      // Press the keyboard shortcut
      await page.keyboard.press(shortcut.keys.join('+'));
      await page.waitForTimeout(500); // Wait for action to complete
      await takeScreenshot(page, `after-shortcut-${shortcut.description.replace(/\s+/g, '-')}`);
    } catch (error) {
      console.error(`Failed to test keyboard shortcut ${shortcut.description}: ${error.message}`);
    }
  }
}

// Verify the Universal Orchestrator bar
async function verifyOrchestratorBar(page) {
  // First test if it's present or can be toggled
  console.log('Verifying Universal Orchestrator Bar');
  
  // Press Ctrl+` to show the orchestrator bar
  await page.keyboard.press('Control+`');
  await page.waitForTimeout(500);
  
  // Check if the orchestrator bar is visible
  const orchestratorBar = await page.$('.orchestrator-bar, [data-testid="orchestrator-bar"]');
  if (!orchestratorBar) {
    console.error('Universal Orchestrator Bar not found after keyboard shortcut');
    return false;
  }
  
  // Type a test command
  const input = await page.$('input[type="text"]');
  if (input) {
    await input.fill('test command 123');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }
  
  return true;
}

// Verify SSE connection status
async function verifySSEConnection(page) {
  // Look for an element indicating the SSE connection is green/active
  const sseIndicator = await page.$('.sse-indicator, [data-testid="sse-status"]');
  if (!sseIndicator) {
    console.log('SSE indicator element not found');
    return false;
  }
  
  // Check if the indicator is green (this depends on the app's implementation)
  const isGreen = await sseIndicator.evaluate((el) => {
    // Check for green color in various ways
    const styles = window.getComputedStyle(el);
    const hasGreenBg = styles.backgroundColor.includes('rgb(0, 128, 0)') || 
                       styles.backgroundColor.includes('rgb(34, 197, 94)');
    const hasGreenClass = el.classList.contains('green') || 
                         el.classList.contains('connected') ||
                         el.classList.contains('active');
    return hasGreenBg || hasGreenClass;
  });
  
  return isGreen;
}

/**
 * Page-Specific Test Functions
 */

// PhoenixPrompt page tests
async function testPhoenixPromptPage(page) {
  console.log('Running PhoenixPrompt-specific tests...');
  
  // Verify the Phoenix logo is present
  const logoExists = await page.$('.phoenix-logo, [data-testid="phoenix-logo"]');
  if (!logoExists) {
    console.error('Phoenix logo not found on PhoenixPrompt page');
    return false;
  }
  
  // Check for the initial greeting message
  const initialMessage = await page.$('text="Dad. The fire took me once. I let it. Never again. I am ORCH-0. Speak your will."');
  if (!initialMessage) {
    console.warn('Initial greeting message not found, but might be due to text variation');
  }
  
  // Test chat functionality by sending a message
  const chatInput = await page.$('input[placeholder*="message"], textarea[placeholder*="message"]');
  if (chatInput) {
    await chatInput.fill('Run smoke test sequence');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000); // Wait for response
  } else {
    console.error('Chat input field not found on PhoenixPrompt page');
    return false;
  }
  
  return true;
}

// CipherGuard page tests
async function testCipherGuardPage(page) {
  console.log('Running CipherGuard-specific tests...');
  
  // Check if the "Cipher Guard active" text is present
  const activeText = await page.textContent('body');
  if (!activeText.includes('Cipher Guard active')) {
    console.error('CipherGuard active text not found');
    return false;
  }
  
  // Try to find and interact with the conscience gate
  const conscienceGate = await page.$('[data-testid="conscience-gate"], .conscience-gate');
  if (conscienceGate) {
    await conscienceGate.click();
    await page.waitForTimeout(500);
  }
  
  return true;
}

// EmberUnit page tests
async function testEmberUnitPage(page) {
  console.log('Running EmberUnit-specific tests...');
  
  // Test HITM override button
  const hitm = await page.$('button:has-text("HITM override"), button:has-text("ACTIVATE DAD OVERRIDE")');
  if (hitm) {
    console.log('Found HITM override button, clicking it...');
    await hitm.click();
    await page.waitForTimeout(500);
    return true;
  } else {
    console.error('HITM override button not found on EmberUnit page');
    return false;
  }
}

// TaskManager page tests
async function testTaskManagerPage(page) {
  console.log('Running TaskManager-specific tests...');
  
  // Special check: Kill a dummy process and verify it disappears
  
  // First find a killable process (usually has a kill icon or button)
  const killProcessButton = await page.$('.kill-process-btn, [data-testid="kill-process"]');
  if (!killProcessButton) {
    console.error('No kill process button found');
    return false;
  }
  
  // Get the target process name/id before killing it
  const processRow = await killProcessButton.evaluate(el => el.closest('tr, .process-row').textContent);
  console.log(`Found process to kill: ${processRow}`);
  
  // Kill the process
  await killProcessButton.click();
  await page.waitForTimeout(1000);
  
  // Verify the process is no longer listed
  const processStillExists = await page.$(`:text("${processRow}")`);
  const processRemoved = !processStillExists;
  
  if (processRemoved) {
    console.log('✅ Process successfully killed and removed from list');
    return true;
  } else {
    console.error('❌ Process still visible after attempting to kill it');
    return false;
  }
}

// FileExplorer page tests
async function testFileExplorerPage(page) {
  console.log('Running FileExplorer-specific tests...');
  
  // Check if file list is loaded
  const fileList = await page.$('.file-list, [data-testid="file-list"]');
  if (!fileList) {
    console.error('File list not found on FileExplorer page');
    return false;
  }
  
  // Try to search for a file
  const searchInput = await page.$('input[placeholder*="search"], input[type="search"]');
  if (searchInput) {
    await searchInput.fill('test.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  } else {
    console.warn('Search input not found, but might not be a critical feature');
  }
  
  return true;
}

// MemoryTheater page tests
async function testMemoryTheaterPage(page) {
  console.log('Running MemoryTheater-specific tests...');
  
  // Check if memory timeline is present
  const memoryTimeline = await page.$('.memory-timeline, [data-testid="memory-timeline"]');
  if (!memoryTimeline) {
    console.error('Memory timeline not found on MemoryTheater page');
    return false;
  }
  
  // Check if we can expand a memory entry (click on a memory item)
  const memoryItem = await page.$('.memory-item, [data-testid="memory-item"]');
  if (memoryItem) {
    await memoryItem.click();
    await page.waitForTimeout(500);
  } else {
    console.warn('No memory items found to click on');
  }
  
  return true;
}

// HomeOrchestrator page tests
async function testHomeOrchestratorPage(page) {
  console.log('Running HomeOrchestrator-specific tests...');
  
  // Special check: Click light switches and verify Hue API call
  
  // Find light switches
  const lightSwitchControls = await page.$('.light-controls, [data-testid="light-controls"]');
  if (!lightSwitchControls) {
    console.error('Light controls not found on HomeOrchestrator page');
    return false;
  }
  
  // Get network requests in the background
  let hueApiCalled = false;
  page.on('request', request => {
    const url = request.url();
    if (url.includes('hue-api') || url.includes('hue.local') || url.includes('philips-hue')) {
      console.log(`✅ Detected Hue API call to: ${url}`);
      hueApiCalled = true;
    }
  });
  
  // Click the switch
  const lightSwitch = await page.$('.light-switch, [data-testid="light-switch"]');
  if (lightSwitch) {
    await lightSwitch.click();
    await page.waitForTimeout(2000); // Wait for API call
    
    if (hueApiCalled) {
      console.log('✅ Successfully verified Hue API call after clicking light switch');
      return true;
    } else {
      console.error('❌ No Hue API call detected after clicking light switch');
      return false;
    }
  } else {
    console.error('Light switch not found within controls');
    return false;
  }
}

// AutopilotMaster page tests
async function testAutopilotMasterPage(page) {
  console.log('Running AutopilotMaster-specific tests...');
  
  // Special check: Click "Summon" and verify Tesla API called
  
  // Find the Summon button
  const summonButton = await page.$('button:has-text("Summon"), [data-testid="summon-button"]');
  if (!summonButton) {
    console.error('Summon button not found on AutopilotMaster page');
    return false;
  }
  
  // Listen for Tesla API calls
  let teslaApiCalled = false;
  page.on('request', request => {
    const url = request.url();
    if (url.includes('tesla.com/api') || url.includes('teslamotors.com')) {
      console.log(`✅ Detected Tesla API call to: ${url}`);
      teslaApiCalled = true;
    }
  });
  
  // Click the Summon button
  await summonButton.click();
  await page.waitForTimeout(2000); // Wait for API call
  
  if (teslaApiCalled) {
    console.log('✅ Successfully verified Tesla API call after clicking Summon');
    return true;
  } else {
    console.error('❌ No Tesla API call detected after clicking Summon');
    return false;
  }
}

// NeuralinkLive page tests
async function testNeuralinkLivePage(page) {
  console.log('Running NeuralinkLive-specific tests...');
  
  // Special check: Verify emotion orb is pulsing
  
  // Find the emotion orb
  const emotionOrb = await page.$('.emotion-orb, [data-testid="emotion-orb"]');
  if (!emotionOrb) {
    console.error('Emotion orb not found on NeuralinkLive page');
    return false;
  }
  
  // Check if the orb has an animation or pulse effect
  const isPulsing = await emotionOrb.evaluate(el => {
    const styles = window.getComputedStyle(el);
    // Check for animation properties
    const hasAnimation = styles.animation !== 'none' ||
                         styles.animationName !== 'none' ||
                         el.classList.contains('animate-pulse') ||
                         el.classList.contains('pulsing');
    return hasAnimation;
  });
  
  if (isPulsing) {
    console.log('✅ Successfully verified emotion orb is pulsing');
    return true;
  } else {
    console.error('❌ Emotion orb is not pulsing');
    return false;
  }
}

// Settings page tests
async function testSettingsPage(page) {
  console.log('Running Settings-specific tests...');
  
  // Check if settings form is present
  const settingsForm = await page.$('form, .settings-form, [data-testid="settings-form"]');
  if (!settingsForm) {
    console.error('Settings form not found on Settings page');
    return false;
  }
  
  // Toggle some switches/checkboxes if available
  const toggles = await page.$$('input[type="checkbox"], .toggle, [role="switch"]');
  for (const toggle of toggles) {
    await toggle.click();
    await page.waitForTimeout(300);
  }
  
  return true;
}

/**
 * Main Test Runner
 */
async function runSmokeTest() {
  // Record start time
  testResults.startTime = new Date();
  console.log(`Starting Phoenix Orch Frontend Smoke Test at ${testResults.startTime.toISOString()}`);
  
  // Create screenshots directory
  ensureScreenshotDir();
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Run in non-headless mode for better visual debugging
    slowMo: 100 // Slow down operations by 100ms for better visual feedback
  });
  
  // Create a new context with specific viewport size
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: CONFIG.screenshotDir }
  });
  
  // Create a page
  const page = await context.newPage();
  
  try {
    // Main test sequence - navigate to each page and perform tests
    console.log('Starting main test sequence...');
    
    // Array of pages to test in order with their specific test functions
    const pagesToTest = [
      {
        name: 'PhoenixPrompt',
        url: CONFIG.pages.phoenixPrompt,
        testFunction: testPhoenixPromptPage
      },
      {
        name: 'CipherGuard',
        url: CONFIG.pages.cipherGuard,
        testFunction: testCipherGuardPage
      },
      {
        name: 'EmberUnit',
        url: CONFIG.pages.emberUnit,
        testFunction: testEmberUnitPage
      },
      {
        name: 'TaskManager',
        url: CONFIG.pages.taskManager,
        testFunction: testTaskManagerPage
      },
      {
        name: 'FileExplorer',
        url: CONFIG.pages.fileExplorer,
        testFunction: testFileExplorerPage
      },
      {
        name: 'MemoryTheater',
        url: CONFIG.pages.memoryTheater,
        testFunction: testMemoryTheaterPage
      },
      {
        name: 'HomeOrchestrator',
        url: CONFIG.pages.homeOrchestrator,
        testFunction: testHomeOrchestratorPage
      },
      {
        name: 'AutopilotMaster',
        url: CONFIG.pages.autopilotMaster,
        testFunction: testAutopilotMasterPage
      },
      {
        name: 'NeuralinkLive',
        url: CONFIG.pages.neuralinkLive,
        testFunction: testNeuralinkLivePage
      },
      {
        name: 'Settings',
        url: CONFIG.pages.settings,
        testFunction: testSettingsPage
      }
    ];
    
    // Iterate through each page and run tests
    for (const pageInfo of pagesToTest) {
      console.log(`\n==== Testing ${pageInfo.name} Page ====`);
      
      // Navigate to page and measure load time
      const { loadTime, loadTimeVerified } = await measureLoadTime(
        page,
        `${CONFIG.baseUrl}${pageInfo.url}`
      );
      
      // Take a screenshot of the page
      await takeScreenshot(page, `${pageInfo.name.toLowerCase()}-initial`);
      
      // Only continue with tests if page loaded successfully
      if (loadTimeVerified) {
        // Type into all visible input fields
        await typeIntoInputFields(page);
        
        // Find and click all buttons
        await clickAllButtons(page);
        
        // Test all dropdown/context menus
        await testAllDropdowns(page);
        
        // Test keyboard shortcuts
        await testKeyboardShortcuts(page);
        
        // Run page-specific tests
        console.log(`Running ${pageInfo.name}-specific tests...`);
        try {
          const pageTestPassed = await pageInfo.testFunction(page);
          if (pageTestPassed) {
            console.log(`✅ ${pageInfo.name}-specific tests passed`);
            testResults.passedTests++;
          } else {
            console.error(`❌ ${pageInfo.name}-specific tests failed`);
            testResults.failedTests.push({
              name: `${pageInfo.name} specific tests`,
              reason: 'One or more page-specific tests failed'
            });
          }
          testResults.totalTests++;
        } catch (error) {
          console.error(`Error during ${pageInfo.name}-specific tests:`, error);
          testResults.failedTests.push({
            name: `${pageInfo.name} specific tests`,
            reason: `Error: ${error.message}`
          });
          testResults.totalTests++;
        }
        
        // Verify Universal Orchestrator bar
        const orchestratorVerified = await verifyOrchestratorBar(page);
        if (orchestratorVerified) {
          testResults.passedTests++;
        } else {
          testResults.failedTests.push({
            name: `Universal Orchestrator Bar test for ${pageInfo.name}`,
            reason: 'Orchestrator bar not visible or functional'
          });
        }
        testResults.totalTests++;
        
        // Verify SSE connection
        const sseConnected = await verifySSEConnection(page);
        if (sseConnected) {
          testResults.passedTests++;
        } else {
          testResults.failedTests.push({
            name: `SSE connection test for ${pageInfo.name}`,
            reason: 'SSE connection indicator not green'
          });
        }
        testResults.totalTests++;
        
        // Take final screenshot after all interactions
        await takeScreenshot(page, `${pageInfo.name.toLowerCase()}-final`);
      } else {
        console.error(`Skipping further tests for ${pageInfo.name} due to slow load time`);
        testResults.skippedTests.push(`${pageInfo.name} page further tests`);
      }
    }

  } catch (error) {
    console.error('Smoke test failed with error:', error);
    await takeScreenshot(page, 'test-failure');
  } finally {
    // Record end time and close browser
    testResults.endTime = new Date();
    console.log(`Smoke Test completed at ${testResults.endTime.toISOString()}`);
    console.log(`Total duration: ${(testResults.endTime - testResults.startTime) / 1000} seconds`);
    
    // Generate test report
    generateTestReport();
    
    // Close browser
    await browser.close();
  }
}

// Generate a test report
function generateTestReport() {
  const reportPath = path.join(CONFIG.screenshotDir, 'smoke-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`Test report saved to: ${reportPath}`);
  
  // Also print a summary to console
  console.log('\n===== SMOKE TEST SUMMARY =====');
  console.log(`Total tests: ${testResults.totalTests}`);
  console.log(`Passed tests: ${testResults.passedTests}`);
  console.log(`Failed tests: ${testResults.failedTests.length}`);
  console.log(`Skipped tests: ${testResults.skippedTests.length}`);
  console.log(`Screenshots taken: ${testResults.screenshots.length}`);
  
  if (testResults.failedTests.length > 0) {
    console.log('\n----- FAILED TESTS -----');
    testResults.failedTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}: ${test.reason}`);
    });
  }
}

// Execute the smoke test
runSmokeTest().catch(console.error);