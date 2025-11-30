/**
 * Phoenix Service Worker Registration Helper
 * Use this to register the service worker and handle updates
 */

// Check if service workers are supported
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Register the service worker with immediate claim
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none' // Don't use cached versions for updates
        });
        console.log('🔥 Phoenix SW registered with scope:', registration.scope);
        
        // Check if periodic sync is supported and register maintenance task
        if ('periodicSync' in registration) {
          try {
            const status = await navigator.permissions.query({
              name: 'periodic-background-sync',
            });
            if (status.state === 'granted') {
              await registration.periodicSync.register('cache-maintenance', {
                minInterval: 24 * 60 * 60 * 1000, // Once a day
              });
              console.log('🔥 Phoenix SW: Periodic sync registered for cache maintenance');
            }
          } catch (error) {
            console.warn('🔥 Phoenix SW: Periodic sync not registered:', error);
          }
        }
        
        // Handle updates when a new service worker is waiting
        if (registration.waiting) {
          console.log('🔥 Phoenix SW: Update waiting to be activated');
          notifyUserOfUpdate(registration.waiting);
        }
        
        // Handle new service worker installations
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔥 Phoenix SW: Update found, installing...');
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('🔥 Phoenix SW: Service worker state changed to:', newWorker.state);
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is installed but waiting
                console.log('🔥 Phoenix SW: New update ready to use');
                notifyUserOfUpdate(newWorker);
              }
            });
          }
        });
        
        // Handle updates from other tabs/windows
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // The active service worker has changed
          console.log('🔥 Phoenix SW: Controller changed, refreshing page...');
          
          // Refresh the page to ensure it uses the new service worker
          window.location.reload();
        });

        // Ensure the service worker is activated even if not controlling the page
        if (!navigator.serviceWorker.controller) {
          console.log('🔥 Phoenix SW: Initial load - service worker not controlling page yet');
        }
        
      } catch (error) {
        console.error('🔥 Phoenix SW: Registration failed:', error);
        // Report the error to analytics or monitoring service
        if (window.phoenixMonitoring && window.phoenixMonitoring.reportError) {
          window.phoenixMonitoring.reportError('SW Registration Failed', error);
        }
      }
    });
  } else {
    console.warn('🔥 Phoenix: Service Workers are not supported in this browser');
    // Check for PWA installability despite no service worker
    checkInstallability();
  }
}

// Check if the app can be installed even without service worker
function checkInstallability() {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🔥 Phoenix: App can be installed despite service worker limitations');
    // Store the event for later use
    window.deferredInstallPrompt = e;
  });
}

// Notify user of update and provide option to update
function notifyUserOfUpdate(worker) {
  // Log the update
  console.log('🔥 Phoenix SW: New version available!');
  
  // Try to use the app's notification component if it exists
  if (window.phoenixNotifications && typeof window.phoenixNotifications.showUpdateNotification === 'function') {
    window.phoenixNotifications.showUpdateNotification(() => applyUpdate(worker));
    return;
  }
  
  // Create a system notification if permissions granted
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Phoenix Update Available', {
      body: 'A new version is available. Click here to update.',
      icon: '/icons/flame.png',
      badge: '/icons/flame-maskable.png',
      tag: 'phoenix-update',
      requireInteraction: true
    });
    
    notification.addEventListener('click', () => {
      notification.close();
      applyUpdate(worker);
    });
    return;
  }
  
  // Request notification permission if not decided yet
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        notifyUserOfUpdate(worker); // Try again after permission granted
      } else {
        showFallbackNotification(worker);
      }
    });
    return;
  }
  
  // Fallback to UI notification
  showFallbackNotification(worker);
}

// Fallback notification when system notifications aren't available
function showFallbackNotification(worker) {
  // Create an in-page notification
  const notificationElement = document.createElement('div');
  notificationElement.className = 'phoenix-update-notification';
  notificationElement.innerHTML = `
    <style>
      .phoenix-update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #111;
        color: white;
        border-left: 4px solid #E63946;
        padding: 16px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        transition: transform 0.3s ease-in-out;
      }
      .phoenix-update-notification.hidden {
        transform: translateX(120%);
      }
      .phoenix-update-notification-icon {
        margin-right: 12px;
        color: #E63946;
      }
      .phoenix-update-notification-content {
        flex: 1;
      }
      .phoenix-update-notification-title {
        font-weight: bold;
        margin-bottom: 4px;
      }
      .phoenix-update-notification-actions {
        display: flex;
        margin-top: 8px;
      }
      .phoenix-update-notification-button {
        background: #E63946;
        color: white;
        border: none;
        padding: 8px 12px;
        margin-right: 8px;
        border-radius: 4px;
        cursor: pointer;
      }
      .phoenix-update-notification-button.secondary {
        background: transparent;
        border: 1px solid #666;
      }
    </style>
    <div class="phoenix-update-notification-icon">🔥</div>
    <div class="phoenix-update-notification-content">
      <div class="phoenix-update-notification-title">Update Available</div>
      <div>A new version of Phoenix is available.</div>
      <div class="phoenix-update-notification-actions">
        <button class="phoenix-update-notification-button update-button">Update Now</button>
        <button class="phoenix-update-notification-button secondary dismiss-button">Later</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notificationElement);
  
  // Add event listeners
  notificationElement.querySelector('.update-button').addEventListener('click', () => {
    notificationElement.classList.add('hidden');
    setTimeout(() => {
      document.body.removeChild(notificationElement);
    }, 300);
    applyUpdate(worker);
  });
  
  notificationElement.querySelector('.dismiss-button').addEventListener('click', () => {
    notificationElement.classList.add('hidden');
    setTimeout(() => {
      document.body.removeChild(notificationElement);
    }, 300);
  });
}

// Apply the update by sending a message to the waiting service worker
function applyUpdate(worker) {
  worker.postMessage('SKIP_WAITING');
}

// Clear specific cache by sending a message to the service worker
function clearCache(cacheName) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
      cacheName: cacheName
    });
    
    return new Promise((resolve) => {
      // Listen for response from service worker
      navigator.serviceWorker.addEventListener('message', function handler(event) {
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve(true);
        }
      });
    });
  }
  
  return Promise.resolve(false);
}

// Expose the API
window.phoenixSW = {
  register: registerServiceWorker,
  clearCache: clearCache,
  update: () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
    }
  }
};

// Auto-register the service worker
registerServiceWorker();