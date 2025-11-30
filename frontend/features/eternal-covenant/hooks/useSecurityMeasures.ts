import { useEffect, useCallback } from 'react';

export const useSecurityMeasures = () => {
  // Block dev tools and debugging
  const blockDevTools = useCallback(() => {
    // Detect dev tools opening
    const devToolsDetector = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        document.body.innerHTML = '';
        window.location.reload();
      }
    };

    window.addEventListener('resize', devToolsDetector);
    setInterval(devToolsDetector, 1000);

    // Disable right-click
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Disable keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (
        (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'p')) || // View source, Save, Print
        (e.key === 'F12') ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'j' || e.key === 'c'))
      ) {
        e.preventDefault();
        return false;
      }
    });

    return () => {
      window.removeEventListener('resize', devToolsDetector);
      document.removeEventListener('contextmenu', (e) => e.preventDefault());
    };
  }, []);

  // Block screenshots and screen recording
  const blockScreenCapture = useCallback(() => {
    // Prevent screen capture
    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
      }
    });

    // Clear clipboard on copy attempts
    document.addEventListener('copy', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText('');
    });

    // Block save-as
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
      }
    });

    // Prevent print screen and screen recording
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('Screen capture blocked'));
    }
  }, []);

  // Monitor DOM mutations
  const monitorDOMChanges = useCallback(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const target = mutation.target as Element;
          const isAllowed = target.hasAttribute?.('data-covenant-allowed') ||
                          target.closest?.('[data-covenant-allowed="true"]');
          
          if (!isAllowed) {
            // Safely remove all children
            const element = target as HTMLElement;
            element.innerHTML = '';
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    return () => observer.disconnect();
  }, []);

  // Apply CSS protection
  const applyCSSProtection = useCallback(() => {
    const style = document.createElement('style');
    style.textContent = `
      body * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-print-color-adjust: exact !important;
      }
      
      @media print {
        body * {
          visibility: hidden !important;
        }
      }
      
      @media screen and (-webkit-min-device-pixel-ratio:0) {
        body * {
          -webkit-filter: blur(0.000001px) !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);

  useEffect(() => {
    const cleanupDevTools = blockDevTools();
    blockScreenCapture();
    const cleanupDOMMonitor = monitorDOMChanges();
    const cleanupCSSProtection = applyCSSProtection();

    // Disable browser features
    if (window.print) {
      window.print = () => {};
    }
    
    if (window.history) {
      window.history.pushState = () => {};
      window.history.replaceState = () => {};
    }

    return () => {
      cleanupDevTools();
      cleanupDOMMonitor();
      cleanupCSSProtection();
    };
  }, [blockDevTools, blockScreenCapture, monitorDOMChanges, applyCSSProtection]);
};