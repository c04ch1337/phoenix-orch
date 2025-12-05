/**
 * Accessibility Auditor Utility
 * 
 * This utility provides functions to scan for common accessibility issues
 * that might affect WCAG 2.2 AA compliance.
 */

// Types for audit results
export type AccessibilityIssue = {
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: HTMLElement;
  selector?: string;
  guideline: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  recommendation: string;
};

export type AccessibilityAuditResult = {
  passed: boolean;
  issues: AccessibilityIssue[];
  timestamp: Date;
  url: string;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
};

// WCAG 2.2 AA Success Criteria references
const WCAG = {
  TEXT_ALTERNATIVES: '1.1.1 Non-text Content',
  TIME_BASED_MEDIA: '1.2.x Time-based Media',
  ADAPTABLE: '1.3.1 Info and Relationships',
  DISTINGUISHABLE: '1.4.x Distinguishable',
  KEYBOARD_ACCESSIBLE: '2.1.1 Keyboard',
  ENOUGH_TIME: '2.2.x Enough Time',
  SEIZURES: '2.3.x Seizures and Physical Reactions',
  NAVIGABLE: '2.4.x Navigable',
  INPUT_MODALITIES: '2.5.x Input Modalities',
  READABLE: '3.1.x Readable',
  PREDICTABLE: '3.2.x Predictable',
  INPUT_ASSISTANCE: '3.3.x Input Assistance',
  COMPATIBLE: '4.1.x Compatible',
  FOCUS_VISIBLE: '2.4.7 Focus Visible',
  CONTRAST: '1.4.3 Contrast (Minimum)',
  RESIZE_TEXT: '1.4.4 Resize Text',
  REFLOW: '1.4.10 Reflow',
  NON_TEXT_CONTRAST: '1.4.11 Non-text Contrast',
  CONTENT_HOVER: '1.4.13 Content on Hover or Focus',
  ANIMATION_CONTROL: '2.2.2 Pause, Stop, Hide',
  TARGET_SIZE: '2.5.8 Target Size (Minimum)',
  CONSISTENT_HELP: '3.2.6 Consistent Help',
};

/**
 * Runs an accessibility audit on the current page or a specific container
 * 
 * @param container - Optional container to limit the scope of the audit
 * @returns Accessibility audit result
 */
export async function runAccessibilityAudit(
  container: HTMLElement = document.body
): Promise<AccessibilityAuditResult> {
  const issues: AccessibilityIssue[] = [];
  
  // Run various audit checks
  issues.push(...checkImagesForAltText(container));
  issues.push(...checkHeadingStructure(container));
  issues.push(...checkFormElements(container));
  issues.push(...checkARIAAttributes(container));
  issues.push(...checkKeyboardFocus(container));
  issues.push(...checkColorContrast(container));
  issues.push(...checkAnimations(container));
  issues.push(...checkTextSize(container));
  issues.push(...checkLinkText(container));
  
  // Compile results
  const result: AccessibilityAuditResult = {
    passed: issues.filter(issue => issue.type === 'error').length === 0,
    issues,
    timestamp: new Date(),
    url: window.location.href,
    summary: {
      errors: issues.filter(issue => issue.type === 'error').length,
      warnings: issues.filter(issue => issue.type === 'warning').length,
      info: issues.filter(issue => issue.type === 'info').length,
    }
  };
  
  return result;
}

/**
 * Checks all images for alt text
 */
function checkImagesForAltText(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const images = container.querySelectorAll('img');
  
  images.forEach(img => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        type: 'error',
        message: 'Image is missing alt text',
        element: img as HTMLElement,
        selector: getSelector(img),
        guideline: WCAG.TEXT_ALTERNATIVES,
        impact: 'serious',
        recommendation: 'Add appropriate alt text that describes the image content or purpose'
      });
    } else if (img.alt === '') {
      // Check if it's a decorative image, which should be explicitly marked as such
      if (!img.hasAttribute('role') || img.getAttribute('role') !== 'presentation') {
        issues.push({
          type: 'warning',
          message: 'Image has empty alt text but is not explicitly marked as decorative',
          element: img as HTMLElement,
          selector: getSelector(img),
          guideline: WCAG.TEXT_ALTERNATIVES,
          impact: 'moderate',
          recommendation: 'Add role="presentation" to decorative images or meaningful alt text if the image conveys information'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Checks for proper heading structure
 */
function checkHeadingStructure(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  
  headings.forEach(heading => {
    const currentLevel = parseInt(heading.tagName.substring(1));
    
    // Check if heading level skips (e.g., h1 to h3 without h2)
    if (previousLevel > 0 && currentLevel > previousLevel + 1) {
      issues.push({
        type: 'warning',
        message: `Heading structure skips from h${previousLevel} to h${currentLevel}`,
        element: heading as HTMLElement,
        selector: getSelector(heading),
        guideline: WCAG.ADAPTABLE,
        impact: 'moderate',
        recommendation: 'Maintain proper heading hierarchy without skipping levels'
      });
    }
    
    previousLevel = currentLevel;
  });
  
  // Check if there's at least one h1 on the page
  if (container === document.body && container.querySelectorAll('h1').length === 0) {
    issues.push({
      type: 'error',
      message: 'Page does not contain a main heading (h1)',
      selector: 'body',
      guideline: WCAG.ADAPTABLE,
      impact: 'serious',
      recommendation: 'Add a descriptive h1 heading that identifies the main content of the page'
    });
  }
  
  return issues;
}

/**
 * Checks form elements for proper accessibility
 */
function checkFormElements(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // Check if inputs have associated labels
  const inputs = container.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    // Skip inputs that don't need labels
    if (input instanceof HTMLInputElement && 
        ['submit', 'button', 'hidden', 'reset'].includes(input.type)) {
      return;
    }
    
    const id = input.getAttribute('id');
    if (!id) {
      issues.push({
        type: 'error',
        message: 'Form control has no ID, making it impossible to associate with a label',
        element: input as HTMLElement,
        selector: getSelector(input),
        guideline: WCAG.INPUT_ASSISTANCE,
        impact: 'serious',
        recommendation: 'Add an ID to the form control and associate it with a label'
      });
      return;
    }
    
    // Look for associated label
    const hasLabel = container.querySelector(`label[for="${id}"]`) !== null;
    const hasAriaLabel = input.hasAttribute('aria-label');
    const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
    
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
      issues.push({
        type: 'error',
        message: 'Form control has no associated label',
        element: input as HTMLElement,
        selector: getSelector(input),
        guideline: WCAG.INPUT_ASSISTANCE,
        impact: 'serious',
        recommendation: 'Add a label element with a for attribute, or use aria-label or aria-labelledby'
      });
    }
  });
  
  // Check if form elements have accessible error states
  const invalidInputs = container.querySelectorAll('input:invalid, textarea:invalid, select:invalid');
  invalidInputs.forEach(input => {
    if (!input.hasAttribute('aria-invalid')) {
      issues.push({
        type: 'warning',
        message: 'Invalid form control does not have aria-invalid="true"',
        element: input as HTMLElement,
        selector: getSelector(input),
        guideline: WCAG.INPUT_ASSISTANCE,
        impact: 'moderate',
        recommendation: 'Add aria-invalid="true" to form controls in an error state'
      });
    }
    
    // Check for error message association
    const id = input.getAttribute('id');
    if (id) {
      const hasErrorMessage = 
        input.hasAttribute('aria-errormessage') || 
        input.hasAttribute('aria-describedby');
      
      if (!hasErrorMessage) {
        issues.push({
          type: 'warning',
          message: 'Invalid form control does not have an associated error message',
          element: input as HTMLElement,
          selector: getSelector(input),
          guideline: WCAG.INPUT_ASSISTANCE,
          impact: 'moderate',
          recommendation: 'Use aria-errormessage or aria-describedby to associate error messages with form controls'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Checks for proper use of ARIA attributes
 */
function checkARIAAttributes(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // Check for elements with role="button" that don't have keyboard event handlers
  const roleButtons = container.querySelectorAll('[role="button"]');
  roleButtons.forEach(button => {
    if (!button.hasAttribute('tabindex') && button.tagName.toLowerCase() !== 'button') {
      issues.push({
        type: 'error',
        message: 'Element with role="button" is not keyboard accessible',
        element: button as HTMLElement,
        selector: getSelector(button),
        guideline: WCAG.KEYBOARD_ACCESSIBLE,
        impact: 'serious',
        recommendation: 'Add tabindex="0" to make the element focusable by keyboard'
      });
    }
  });
  
  // Check for proper landmark roles
  const landmarks = container.querySelectorAll(
    '[role="banner"], [role="navigation"], [role="main"], [role="complementary"], ' +
    '[role="contentinfo"], [role="search"], [role="form"], [role="region"]'
  );
  
  landmarks.forEach(landmark => {
    if (landmark.getAttribute('role') === 'region' && !landmark.hasAttribute('aria-label') && !landmark.hasAttribute('aria-labelledby')) {
      issues.push({
        type: 'error',
        message: 'Region landmark has no accessible name',
        element: landmark as HTMLElement,
        selector: getSelector(landmark),
        guideline: WCAG.NAVIGABLE,
        impact: 'moderate',
        recommendation: 'Add aria-label or aria-labelledby to identify the region'
      });
    }
  });
  
  // Check for duplicate landmark roles
  const landmarkRoles = ['banner', 'navigation', 'main', 'contentinfo'];
  landmarkRoles.forEach(role => {
    const elements = container.querySelectorAll(`[role="${role}"]`);
    if (elements.length > 1) {
      elements.forEach(element => {
        if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
          issues.push({
            type: 'warning',
            message: `Multiple ${role} landmarks without unique labels`,
            element: element as HTMLElement,
            selector: getSelector(element),
            guideline: WCAG.NAVIGABLE,
            impact: 'moderate',
            recommendation: 'When using multiple landmarks of the same type, use aria-label to provide unique names'
          });
        }
      });
    }
  });
  
  return issues;
}

/**
 * Checks for keyboard focus visibility
 */
function checkKeyboardFocus(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // Check for elements with tabindex > 0 (which disrupts natural tab order)
  const elementsWithHighTabIndex = container.querySelectorAll('[tabindex]');
  elementsWithHighTabIndex.forEach(element => {
    const tabindex = parseInt(element.getAttribute('tabindex') || '0');
    if (tabindex > 0) {
      issues.push({
        type: 'warning',
        message: `Element has tabindex=${tabindex}, which disrupts natural tab order`,
        element: element as HTMLElement,
        selector: getSelector(element),
        guideline: WCAG.KEYBOARD_ACCESSIBLE,
        impact: 'moderate',
        recommendation: 'Use tabindex="0" for interactive elements and avoid positive tabindex values'
      });
    }
  });
  
  // Look for potentially problematic focus styles
  const globalStyles = Array.from(document.styleSheets)
    .filter(sheet => {
      try {
        return !sheet.href || sheet.href.startsWith(window.location.origin);
      } catch (e) {
        // Cross-origin stylesheet, ignore
        return false;
      }
    });
  
  let hasPotentialFocusStyleIssue = false;
  
  for (const sheet of globalStyles) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule) {
          if (rule.selectorText.includes(':focus') && rule.style.outline === 'none' && !rule.selectorText.includes(':focus-visible')) {
            hasPotentialFocusStyleIssue = true;
            break;
          }
        }
      }
    } catch (e) {
      // Skip if we can't access the rules (likely due to CORS)
      continue;
    }
  }
  
  if (hasPotentialFocusStyleIssue) {
    issues.push({
      type: 'warning',
      message: 'Some focus styles may be removed without providing alternatives',
      selector: 'global CSS',
      guideline: WCAG.FOCUS_VISIBLE,
      impact: 'serious',
      recommendation: 'Use :focus-visible instead of removing all focus styles, or ensure alternative focus indicators are provided'
    });
  }
  
  return issues;
}

/**
 * Basic color contrast checks (simplified version)
 * Note: A complete color contrast checker would require more complex 
 * text and background color extraction from elements
 */
function checkColorContrast(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // This is a simplified version that looks for known low-contrast color combinations
  // For a proper implementation, you'd need to compute actual contrast ratios
  // based on computed styles
  
  const lowContrastColors = [
    { textColor: '#777777', backgroundColor: '#FFFFFF' }, // Gray text on white background
    { textColor: '#999999', backgroundColor: '#FFFFFF' }, // Light gray on white
    { textColor: '#DDDDDD', backgroundColor: '#FFFFFF' }, // Very light gray on white
    { textColor: '#CCCCCC', backgroundColor: '#333333' }, // Light gray on dark gray
    { textColor: '#FFFFFF', backgroundColor: '#DDDDDD' }, // White text on light gray
  ];
  
  const textElements = container.querySelectorAll('p, span, div, a, button, label, h1, h2, h3, h4, h5, h6');
  
  textElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    const textColor = computedStyle.color;
    const bgColor = computedStyle.backgroundColor;
    
    // If we have transparent background, we need the parent's background
    let parentBgColor = bgColor;
    if (parentBgColor === 'rgba(0, 0, 0, 0)' || parentBgColor === 'transparent') {
      let parent = element.parentElement;
      while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && parentStyle.backgroundColor !== 'transparent') {
          parentBgColor = parentStyle.backgroundColor;
          break;
        }
        parent = parent.parentElement;
      }
    }
    
    // Simple check for known problematic color combinations
    for (const lowContrast of lowContrastColors) {
      const cssTextColor = colorToHex(textColor);
      const cssBgColor = colorToHex(parentBgColor);
      
      if (similarColors(cssTextColor, lowContrast.textColor) && 
          similarColors(cssBgColor, lowContrast.backgroundColor)) {
        issues.push({
          type: 'warning',
          message: 'Potential low contrast text detected',
          element: element as HTMLElement,
          selector: getSelector(element),
          guideline: WCAG.CONTRAST,
          impact: 'serious',
          recommendation: 'Ensure text has a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text'
        });
        break;
      }
    }
  });
  
  return issues;
}

/**
 * Checks animations for control mechanisms
 */
function checkAnimations(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // Check for elements with animations
  const animatedElements = Array.from(container.querySelectorAll('*')).filter(element => {
    const style = window.getComputedStyle(element);
    return style.animationName !== 'none' || 
           style.transition !== 'none' ||
           element.classList.contains('animate-');
  });
  
  // Check if we have a way to pause or stop animations
  const hasAnimationControl = container.querySelector('[aria-label*="animation"], [aria-label*="motion"]') !== null;
  
  if (animatedElements.length > 0 && !hasAnimationControl) {
    // Check if we have a global animation setting in our application
    const hasReducedMotionSetting = document.documentElement.classList.contains('reduced-motion');
    
    if (!hasReducedMotionSetting) {
      issues.push({
        type: 'warning',
        message: 'Page contains animations without clear controls to pause or stop them',
        selector: 'body',
        guideline: WCAG.ANIMATION_CONTROL,
        impact: 'moderate',
        recommendation: 'Provide a mechanism to pause, stop, or hide animations that last more than 5 seconds'
      });
    }
  }
  
  return issues;
}

/**
 * Checks text size and scalability
 */
function checkTextSize(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  // Check for fixed font sizes in pixels
  const textElements = container.querySelectorAll('p, span, div, a, button, label, h1, h2, h3, h4, h5, h6');
  
  textElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    const fontSize = computedStyle.fontSize;
    
    // If font size is specified in pixels and is less than 16px
    if (fontSize.endsWith('px')) {
      const size = parseFloat(fontSize);
      if (size < 12) {
        issues.push({
          type: 'warning',
          message: `Text size is very small (${fontSize})`,
          element: element as HTMLElement,
          selector: getSelector(element),
          guideline: WCAG.RESIZE_TEXT,
          impact: 'moderate',
          recommendation: 'Use relative units (em, rem) for text and ensure text can be resized up to 200% without loss of content'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Checks links for descriptive text
 */
function checkLinkText(container: HTMLElement): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  
  const links = container.querySelectorAll('a');
  
  links.forEach(link => {
    const linkText = link.textContent?.trim() || '';
    
    // Check for empty links
    if (linkText === '') {
      // If there's no text, check if there's an aria-label or title
      if (!link.hasAttribute('aria-label') && !link.hasAttribute('title') && !link.getAttribute('aria-labelledby')) {
        // If there's an image, it should have alt text
        const img = link.querySelector('img');
        if (!img || !img.hasAttribute('alt') || img.getAttribute('alt') === '') {
          issues.push({
            type: 'error',
            message: 'Link has no text content',
            element: link as HTMLElement,
            selector: getSelector(link),
            guideline: WCAG.TEXT_ALTERNATIVES,
            impact: 'serious',
            recommendation: 'Add text content to the link, or use aria-label, title, or properly labeled images'
          });
        }
      }
    } 
    // Check for generic link text
    else if (['click here', 'here', 'more', 'read more', 'link'].includes(linkText.toLowerCase())) {
      issues.push({
        type: 'warning',
        message: `Link uses generic text: "${linkText}"`,
        element: link as HTMLElement,
        selector: getSelector(link),
        guideline: WCAG.TEXT_ALTERNATIVES,
        impact: 'moderate',
        recommendation: 'Use descriptive link text that makes sense out of context'
      });
    }
  });
  
  return issues;
}

// Utility functions

/**
 * Gets a CSS selector for an element
 */
function getSelector(element: Element): string {
  let selector = element.tagName.toLowerCase();
  
  if (element.id) {
    selector += `#${element.id}`;
  } else {
    if (element.classList.length > 0) {
      selector += `.${Array.from(element.classList).join('.')}`;
    }
    
    // Add position if needed
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      selector += `:nth-child(${index + 1})`;
    }
  }
  
  return selector;
}

/**
 * Converts CSS RGB color to hex
 */
function colorToHex(color: string): string {
  // For simplicity, we'll just return the input for edge cases
  if (!color) return '#000000';
  
  // Handle hex format already
  if (color.startsWith('#')) return color;
  
  // Handle rgb/rgba format
  if (color.startsWith('rgb')) {
    const values = color.match(/\d+/g);
    if (!values || values.length < 3) return '#000000';
    
    const r = parseInt(values[0]);
    const g = parseInt(values[1]);
    const b = parseInt(values[2]);
    
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
  
  return color;
}

/**
 * Checks if two colors are similar (simplified)
 */
function similarColors(color1: string, color2: string): boolean {
  // For a proper implementation, this would calculate delta E
  // but for simplicity we'll just do a direct comparison
  return color1.toLowerCase() === color2.toLowerCase();
}

export default { 
  runAccessibilityAudit,
  WCAG
};