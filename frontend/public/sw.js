/**
 * Phoenix Frontend Service Worker
 * Enhanced Cache-First implementation with offline support
 * Compatible with Next.js - 2025 Best Practices
 */

// Cache version - update when changing cache structure or critical assets
const CACHE_VERSION = 'phoenix-orch-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Maximum number of items in dynamic cache to prevent excessive storage
const DYNAMIC_CACHE_LIMIT = 100;
// Maximum age for cached API responses in milliseconds (15 minutes)
const API_CACHE_MAX_AGE = 15 * 60 * 1000;
// Maximum size for image cache in bytes (50MB)
const IMAGE_CACHE_MAX_SIZE = 50 * 1024 * 1024;

// Critical assets to precache during installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/_next/static/', // Next.js assets directory
  '/icons/',
  // Fonts and external dependencies
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap',
  // Import Map Modules - Caching latest versions
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/@google/genai@^1.30.0',
  'https://aistudiocdn.com/lucide-react@^0.554.0',
  'https://aistudiocdn.com/recharts@^3.4.1',
  'https://aistudiocdn.com/framer-motion@^11.0.28',
  'https://unpkg.com/dexie@latest/dist/modern/dexie.mjs'
];

// API endpoints that should not be cached
const API_ENDPOINTS = [
  '/api/',
  '/sse/',
  '/graphql'
];

// Background sync queue name
const SYNC_QUEUE_NAME = 'phoenix-background-sync';

/**
 * Logger utility
 */
const logger = {
  info: (message) => {
    console.log(`🔥 Phoenix SW: ${message}`);
  },
  error: (message, error) => {
    console.error(`⚠️ Phoenix SW Error: ${message}`, error);
  },
  warn: (message) => {
    console.warn(`⚠️ Phoenix SW Warning: ${message}`);
  }
};

/**
 * Cache utility functions
 */
const cacheUtils = {
  /**
   * Adds items to a specific cache
   * @param {string} cacheName - The name of the cache
   * @param {Array} items - Array of URLs to cache
   */
  addToCache: async (cacheName, items) => {
    try {
      const cache = await caches.open(cacheName);
      await cache.addAll(items);
      logger.info(`Added ${items.length} items to ${cacheName}`);
    } catch (error) {
      logger.error(`Failed to add items to ${cacheName}`, error);
      throw error;
    }
  },

  /**
   * Limits the size of a cache by removing oldest entries first
   * @param {string} cacheName - The name of the cache to trim
   * @param {number} maxItems - Maximum number of items to keep
   */
  trimCache: async (cacheName, maxItems) => {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      if (keys.length > maxItems) {
        logger.info(`Trimming cache ${cacheName} (${keys.length} > ${maxItems})`);
        const itemsToDelete = keys.length - maxItems;
        for (let i = 0; i < itemsToDelete; i++) {
          await cache.delete(keys[i]);
        }
      }
    } catch (error) {
      logger.error(`Error trimming cache ${cacheName}`, error);
    }
  },

  /**
   * Delete old caches that are not in the whitelist
   * @param {Array} cacheWhitelist - Array of cache names to keep
   */
  deleteOldCaches: async (cacheWhitelist) => {
    try {
      const cacheNames = await caches.keys();
      const deletionPromises = cacheNames.map(cacheName => {
        if (!cacheWhitelist.includes(cacheName)) {
          logger.info(`Deleting old cache: ${cacheName}`);
          return caches.delete(cacheName);
        }
      });
      
      await Promise.all(deletionPromises);
    } catch (error) {
      logger.error('Error deleting old caches', error);
    }
  },

  /**
   * Calculates the total size of a cache in bytes
   * @param {string} cacheName - The name of the cache
   * @returns {Promise<number>} The total size in bytes
   */
  getCacheSize: async (cacheName) => {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const request of keys) {
        const response = await cache.match(request);
        const blob = await response.blob();
        totalSize += blob.size;
      }
      
      return totalSize;
    } catch (error) {
      logger.error(`Error calculating cache size for ${cacheName}`, error);
      return 0;
    }
  },

  /**
   * Trims the image cache if it exceeds the maximum size
   */
  trimImageCache: async () => {
    try {
      const totalSize = await cacheUtils.getCacheSize(IMAGE_CACHE);
      
      if (totalSize > IMAGE_CACHE_MAX_SIZE) {
        logger.info(`Image cache exceeds limit (${totalSize}/${IMAGE_CACHE_MAX_SIZE} bytes)`);
        const cache = await caches.open(IMAGE_CACHE);
        const keys = await cache.keys();
        
        // Sort by date
        const requests = await Promise.all(keys.map(async (key) => {
          const response = await cache.match(key);
          const headers = new Headers(response.headers);
          const date = headers.get('date') ? new Date(headers.get('date')).getTime() : 0;
          return { request: key, date };
        }));
        
        // Sort oldest first
        requests.sort((a, b) => a.date - b.date);
        
        // Remove oldest entries until under limit
        let currentSize = totalSize;
        for (const { request } of requests) {
          if (currentSize <= IMAGE_CACHE_MAX_SIZE) break;
          
          const response = await cache.match(request);
          const blob = await response.blob();
          await cache.delete(request);
          currentSize -= blob.size;
        }
      }
    } catch (error) {
      logger.error('Error trimming image cache', error);
    }
  }
};

/**
 * Network utility functions
 */
const networkUtils = {
  /**
   * Checks if the URL is an API endpoint
   * @param {string} url - The URL to check
   * @returns {boolean} True if it's an API endpoint
   */
  isApiEndpoint: (url) => {
    return API_ENDPOINTS.some(endpoint => url.includes(endpoint));
  },

  /**
   * Checks if the URL is an SSE endpoint
   * @param {string} url - The URL to check
   * @returns {boolean} True if it's an SSE endpoint
   */
  isSseEndpoint: (url) => {
    return url.includes('/sse/') || url.includes('/events/');
  },

  /**
   * Checks if the URL is an image file
   * @param {string} url - The URL to check
   * @returns {boolean} True if it's an image
   */
  isImageRequest: (url) => {
    return /\.(jpe?g|png|gif|svg|webp|avif)$/i.test(url);
  },

  /**
   * Checks if the URL is a static asset
   * @param {string} url - The URL to check
   * @returns {boolean} True if it's a static asset
   */
  isStaticAsset: (url) => {
    return /\.(css|js|woff2?|ttf|eot|html)$/i.test(url) || 
           url.includes('/_next/static/') ||
           url.includes('/icons/');
  }
};

/**
 * Offline fallback generator
 * @param {string} url - The URL that failed
 * @returns {Response} A fallback response
 */
const generateOfflineFallback = (url) => {
  if (url.includes('/api/')) {
    // API fallback - return cached data with offline notice
    return new Response(JSON.stringify({
      error: 'You are currently offline',
      offlineAt: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (networkUtils.isImageRequest(url)) {
    // Image fallback - could return a default offline image
    return new Response('Image unavailable offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  } else {
    // HTML fallback - return the application shell
    return caches.match('/') || new Response('Offline - Phoenix App', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

// Background sync operations
const syncManager = {
  /**
   * Initialize background sync
   */
  initialize: () => {
    if ('sync' in self.registration) {
      logger.info('Background sync is supported');
      
      // Register a sync listener if not already registered
      self.addEventListener('sync', syncManager.handleSync);
    } else {
      logger.warn('Background sync is not supported');
    }
  },
  
  /**
   * Handle sync events
   * @param {SyncEvent} event - The sync event
   */
  handleSync: async (event) => {
    logger.info(`Background sync event: ${event.tag}`);
    
    // Process different sync tags
    if (event.tag === SYNC_QUEUE_NAME) {
      event.waitUntil(syncManager.processQueue());
    }
  },
  
  /**
   * Process the sync queue
   */
  processQueue: async () => {
    try {
      // Use IndexedDB to get queued requests
      const db = await openDB('phoenix-offline-queue', 1, {
        upgrade(db) {
          db.createObjectStore('requests', { keyPath: 'id' });
        }
      });
      
      const tx = db.transaction('requests', 'readwrite');
      const store = tx.objectStore('requests');
      const requests = await store.getAll();
      
      logger.info(`Processing ${requests.length} queued requests`);
      
      // Process each queued request
      for (const queuedRequest of requests) {
        try {
          const response = await fetch(queuedRequest.request.url, {
            method: queuedRequest.request.method,
            headers: queuedRequest.request.headers,
            body: queuedRequest.request.body,
            credentials: 'include'
          });
          
          if (response.ok) {
            // Request successful, remove from queue
            await store.delete(queuedRequest.id);
            logger.info(`Successfully synced request to ${queuedRequest.request.url}`);
            
            // Notify clients of successful sync
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                request: queuedRequest.request.url,
                timestamp: Date.now()
              });
            });
          }
        } catch (error) {
          logger.error(`Failed to sync request: ${queuedRequest.request.url}`, error);
          // Keep in queue for next sync attempt
        }
      }
      
      await tx.complete;
      
    } catch (error) {
      logger.error('Error processing sync queue', error);
    }
  }
};

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  logger.info('Service Worker installing');
  
  event.waitUntil(
    (async () => {
      try {
        // Cache static assets during installation
        await cacheUtils.addToCache(STATIC_CACHE, PRECACHE_ASSETS);
        
        // Initialize empty caches for other categories
        await caches.open(DYNAMIC_CACHE);
        await caches.open(API_CACHE);
        await caches.open(IMAGE_CACHE);
        
        logger.info('Precaching complete');
      } catch (error) {
        logger.error('Failed to complete precaching', error);
      }
    })()
  );
  
  // Force activation without waiting for tabs to close
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  logger.info('Service Worker activating');
  
  event.waitUntil(
    (async () => {
      try {
        // Delete old caches
        const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];
        await cacheUtils.deleteOldCaches(cacheWhitelist);
        
        // Initialize background sync
        syncManager.initialize();
        
        // Claim all clients
        await self.clients.claim();
        
        logger.info('Service Worker activated and claiming clients');
      } catch (error) {
        logger.error('Failed to activate service worker', error);
      }
    })()
  );
});

// Fetch event - handle all network requests with appropriate strategies
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Skip non-GET requests or cross-origin requests that don't match our caching patterns
  if (event.request.method !== 'GET' || 
      !url.includes(self.location.origin) && 
      !PRECACHE_ASSETS.some(asset => url.includes(asset))) {
    return;
  }
  
  // Choose cache strategy based on request type
  let strategy;
  
  if (networkUtils.isApiEndpoint(url)) {
    strategy = handleApiRequest;
  } else if (networkUtils.isSseEndpoint(url)) {
    strategy = networkOnlyStrategy;
  } else if (networkUtils.isImageRequest(url)) {
    strategy = handleImageRequest;
  } else if (networkUtils.isStaticAsset(url)) {
    strategy = cacheFirstStrategy;
  } else {
    // For other requests (HTML pages, etc.)
    strategy = staleWhileRevalidateStrategy;
  }
  
  event.respondWith(strategy(event));
});

/**
 * Network-only strategy - always goes to network, never caches
 * Used for SSE and other streaming endpoints
 */
async function networkOnlyStrategy(event) {
  try {
    return await fetch(event.request);
  } catch (error) {
    logger.error(`Network request failed: ${event.request.url}`, error);
    throw error;
  }
}

/**
 * Cache-first strategy - check cache first, fall back to network
 * Used for static assets like CSS, JS, fonts
 */
async function cacheFirstStrategy(event) {
  const url = event.request.url;
  
  try {
    // Try the static cache first
    const staticCache = await caches.open(STATIC_CACHE);
    const cachedResponse = await staticCache.match(event.request);
    
    if (cachedResponse) {
      logger.info(`Cache hit for: ${url}`);
      
      // Revalidate in the background for next time
      revalidateInBackground(event.request, STATIC_CACHE);
      
      return cachedResponse;
    }
    
    // Not in cache, fetch from network and cache
    logger.info(`Cache miss for: ${url}, fetching from network`);
    const networkResponse = await fetch(event.request);
    
    // Cache the response if valid
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      staticCache.put(event.request, clonedResponse);
      logger.info(`Cached for next time: ${url}`);
    }
    
    return networkResponse;
  } catch (error) {
    logger.error(`Cache-first strategy failed for: ${url}`, error);
    
    // Try to return something from any cache as a fallback
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;
    
    // Generate an offline fallback
    return generateOfflineFallback(url);
  }
}

/**
 * Stale-while-revalidate strategy
 * Used for HTML and other document requests, serves cached version immediately
 * while updating cache in background
 */
async function staleWhileRevalidateStrategy(event) {
  const url = event.request.url;
  
  try {
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await dynamicCache.match(event.request);
    
    // Start network fetch regardless of cache status
    const fetchPromise = fetch(event.request)
      .then(networkResponse => {
        if (networkResponse.ok) {
          const clonedResponse = networkResponse.clone();
          dynamicCache.put(event.request, clonedResponse);
          
          // Trim cache if needed
          cacheUtils.trimCache(DYNAMIC_CACHE, DYNAMIC_CACHE_LIMIT);
          
          logger.info(`Updated cache for: ${url}`);
        }
        return networkResponse;
      })
      .catch(error => {
        logger.warn(`Network request failed for: ${url}`, error);
        throw error;
      });
    
    // If we have a cached response, use it immediately
    if (cachedResponse) {
      logger.info(`Using cached response for: ${url}`);
      return cachedResponse;
    }
    
    // Otherwise wait for the network response
    return fetchPromise;
    
  } catch (error) {
    logger.error(`Stale-while-revalidate strategy failed for: ${url}`, error);
    
    // Try to return something from any cache as a fallback
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;
    
    // Generate an offline fallback
    return generateOfflineFallback(url);
  }
}

/**
 * Special handling for API requests
 * Network with timed cache fallback
 */
async function handleApiRequest(event) {
  const url = event.request.url;
  
  // Do not cache POST, PUT, DELETE requests
  if (event.request.method !== 'GET') {
    // If offline, queue the request for background sync
    if (!navigator.onLine) {
      try {
        await queueRequestForBackgroundSync(event.request);
        return new Response(JSON.stringify({ 
          success: false, 
          offlineQueued: true, 
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error('Failed to queue request for background sync', error);
      }
    }
    
    // Otherwise, proceed with network request
    return fetch(event.request);
  }
  
  try {
    // Try network first for API requests
    const networkResponse = await fetch(event.request);
    
    // Cache successful GET responses with timestamp
    if (networkResponse.ok) {
      const apiCache = await caches.open(API_CACHE);
      
      // Add timestamp header to the response before caching
      const headers = new Headers(networkResponse.headers);
      headers.append('sw-timestamp', Date.now().toString());
      
      const responseToCache = new Response(networkResponse.clone().body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      
      apiCache.put(event.request, responseToCache);
      logger.info(`Cached API response: ${url}`);
    }
    
    return networkResponse;
    
  } catch (error) {
    logger.warn(`API request failed for: ${url}, checking cache`);
    
    // Network failed, try cache
    const apiCache = await caches.open(API_CACHE);
    const cachedResponse = await apiCache.match(event.request);
    
    if (cachedResponse) {
      // Check if the cached response is still valid
      const headers = new Headers(cachedResponse.headers);
      const timestamp = parseInt(headers.get('sw-timestamp') || '0');
      const age = Date.now() - timestamp;
      
      if (age < API_CACHE_MAX_AGE) {
        logger.info(`Using cached API response: ${url} (age: ${age}ms)`);
        return cachedResponse;
      } else {
        logger.info(`Cached API response too old: ${url} (age: ${age}ms)`);
      }
    }
    
    // No valid cached response, return offline fallback
    return generateOfflineFallback(url);
  }
}

/**
 * Special handling for image requests
 * Cache-first with background update and size management
 */
async function handleImageRequest(event) {
  const url = event.request.url;
  
  try {
    // Try the image cache first
    const imageCache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await imageCache.match(event.request);
    
    if (cachedResponse) {
      logger.info(`Cache hit for image: ${url}`);
      
      // Revalidate image in background only if it's old
      const headers = new Headers(cachedResponse.headers);
      const cachedDate = headers.get('date') ? new Date(headers.get('date')).getTime() : 0;
      const age = Date.now() - cachedDate;
      
      // Revalidate if older than 7 days
      if (age > 7 * 24 * 60 * 60 * 1000) {
        revalidateInBackground(event.request, IMAGE_CACHE);
      }
      
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    logger.info(`Cache miss for image: ${url}`);
    const networkResponse = await fetch(event.request);
    
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      await imageCache.put(event.request, clonedResponse);
      
      // Manage cache size
      cacheUtils.trimImageCache();
      
      logger.info(`Cached image: ${url}`);
    }
    
    return networkResponse;
    
  } catch (error) {
    logger.error(`Image request failed: ${url}`, error);
    
    // Try to return any cached version as fallback
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;
    
    // Generate a fallback
    return generateOfflineFallback(url);
  }
}

/**
 * Queue a request for background sync
 * @param {Request} request - The request to queue
 */
async function queueRequestForBackgroundSync(request) {
  if (!('sync' in self.registration)) {
    logger.warn('Background sync not supported');
    return;
  }
  
  // Clone request data for storage
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body: await request.clone().text(),
    credentials: request.credentials
  };
  
  // Store in IndexedDB
  try {
    const db = await openDB('phoenix-offline-queue', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('requests')) {
          db.createObjectStore('requests', { keyPath: 'id' });
        }
      }
    });
    
    await db.add('requests', {
      id: Date.now().toString(),
      timestamp: Date.now(),
      request: requestData
    });
    
    // Register for sync
    await self.registration.sync.register(SYNC_QUEUE_NAME);
    
    logger.info(`Queued for background sync: ${request.url}`);
  } catch (error) {
    logger.error('Failed to queue for background sync', error);
    throw error;
  }
}

/**
 * Revalidate a cached response in the background without blocking
 * @param {Request} request - The request to revalidate
 * @param {string} cacheName - Cache to update
 */
function revalidateInBackground(request, cacheName) {
  setTimeout(async () => {
    try {
      const response = await fetch(request.clone());
      
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response);
        logger.info(`Background revalidation complete: ${request.url}`);
      }
    } catch (error) {
      logger.warn(`Background revalidation failed: ${request.url}`, error);
    }
  }, 0);
}

/**
 * IndexedDB helper for opening databases
 * @param {string} name - Database name
 * @param {number} version - Database version
 * @param {Object} options - Options including upgrade callback
 */
function openDB(name, version, { upgrade } = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion, event.newVersion);
    };
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Message handling
self.addEventListener('message', (event) => {
  logger.info(`Received message from client: ${JSON.stringify(event.data)}`);
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    logger.info('skipWaiting() called');
  } else if (event.data.type === 'CLEAR_CACHE') {
    // Clear specific or all caches on demand
    event.waitUntil((async () => {
      try {
        if (event.data.cacheName) {
          // Clear specific cache
          await caches.delete(event.data.cacheName);
          logger.info(`Cleared cache: ${event.data.cacheName}`);
        } else {
          // Clear all caches
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          logger.info('Cleared all caches');
        }
        
        // Notify the client that the operation completed
        const client = await self.clients.get(event.source.id);
        client.postMessage({
          type: 'CACHE_CLEARED',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Failed to clear cache', error);
      }
    })());
  }
});

// Periodic cache maintenance
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-maintenance') {
    event.waitUntil((async () => {
      try {
        logger.info('Performing periodic cache maintenance');
        
        // Trim all caches to prevent excessive storage use
        await cacheUtils.trimCache(DYNAMIC_CACHE, DYNAMIC_CACHE_LIMIT);
        await cacheUtils.trimImageCache();
        
        // Clean up expired API cache entries
        const apiCache = await caches.open(API_CACHE);
        const requests = await apiCache.keys();
        
        for (const request of requests) {
          const response = await apiCache.match(request);
          const headers = new Headers(response.headers);
          const timestamp = parseInt(headers.get('sw-timestamp') || '0');
          const age = Date.now() - timestamp;
          
          if (age > API_CACHE_MAX_AGE) {
            await apiCache.delete(request);
            logger.info(`Removed expired API cache entry: ${request.url}`);
          }
        }
        
        logger.info('Cache maintenance completed');
      } catch (error) {
        logger.error('Error in cache maintenance', error);
      }
    })());
  }
});