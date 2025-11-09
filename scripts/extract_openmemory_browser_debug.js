/**
 * Enhanced OpenMemory Browser Extraction Script with Debugging
 * 
 * Instructions:
 * 1. Go to app.openmemory.dev and log in
 * 2. Navigate to your memories page
 * 3. Open browser developer tools (F12)
 * 4. Go to Console tab
 * 5. Copy and paste this script
 * 6. Run it
 * 7. Check the console output to see what it finds
 */

(async function extractOpenMemoryMemoriesDebug() {
  console.log('🔍 Starting OpenMemory memory extraction (DEBUG MODE)...');
  console.log('📍 Current URL:', window.location.href);
  
  const memories = [];
  const debugInfo = {
    domElements: [],
    windowVars: [],
    networkCalls: [],
    localStorage: {},
    sessionStorage: {}
  };
  
  // Debug: Check localStorage and sessionStorage
  console.log('\n📦 Checking localStorage and sessionStorage...');
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      debugInfo.localStorage[key] = localStorage.getItem(key)?.substring(0, 100);
    }
    console.log('  LocalStorage keys:', Object.keys(debugInfo.localStorage));
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      debugInfo.sessionStorage[key] = sessionStorage.getItem(key)?.substring(0, 100);
    }
    console.log('  SessionStorage keys:', Object.keys(debugInfo.sessionStorage));
  } catch (e) {
    console.log('  ⚠️ Error accessing storage:', e);
  }
  
  // Debug: Check all window variables that might contain memory data
  console.log('\n🔍 Checking window variables...');
  const memoryKeywords = ['memory', 'memories', 'mem0', 'openmemory', 'data', 'store', 'cache'];
  for (const keyword of memoryKeywords) {
    for (const key in window) {
      if (key.toLowerCase().includes(keyword)) {
        try {
          const value = window[key];
          if (value && typeof value === 'object') {
            debugInfo.windowVars.push({
              key: key,
              type: typeof value,
              isArray: Array.isArray(value),
              keys: Object.keys(value).slice(0, 10)
            });
            console.log(`  ✓ Found window.${key}:`, typeof value, Array.isArray(value) ? `(array, length: ${value.length})` : '');
            
            // Try to extract memories from this variable
            if (Array.isArray(value)) {
              memories.push(...value);
            } else if (value.memories && Array.isArray(value.memories)) {
              memories.push(...value.memories);
            } else if (value.results && Array.isArray(value.results)) {
              memories.push(...value.results);
            } else if (value.data && Array.isArray(value.data)) {
              memories.push(...value.data);
            }
          }
        } catch (e) {
          // Skip if we can't access it
        }
      }
    }
  }
  
  // Debug: Check DOM more thoroughly
  console.log('\n📋 Checking DOM elements...');
  const allElements = document.querySelectorAll('*');
  console.log(`  Total elements on page: ${allElements.length}`);
  
  // Look for common memory/data containers
  const containerSelectors = [
    '[class*="memory"]',
    '[class*="item"]',
    '[class*="card"]',
    '[class*="list"]',
    '[class*="data"]',
    '[id*="memory"]',
    '[data-testid*="memory"]',
    '[data-testid*="item"]',
    'table tbody tr',
    'ul li',
    'div[role="listitem"]',
    '[aria-label*="memory"]'
  ];
  
  for (const selector of containerSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0 && elements.length < 1000) { // Reasonable number
        console.log(`  ✓ Found ${elements.length} elements with selector: ${selector}`);
        debugInfo.domElements.push({
          selector: selector,
          count: elements.length,
          sample: elements[0]?.textContent?.substring(0, 100)
        });
        
        // Try to extract data from first few elements
        Array.from(elements).slice(0, 10).forEach((el, idx) => {
          const text = el.textContent?.trim();
          if (text && text.length > 20 && text.length < 5000) {
            // Might be a memory
            memories.push({
              id: `dom-${selector}-${idx}`,
              content: text,
              source: 'dom',
              selector: selector
            });
          }
        });
      }
    } catch (e) {
      // Skip invalid selectors
    }
  }
  
  // Debug: Check for React/Vue/Angular component data
  console.log('\n⚛️ Checking for React/Vue component data...');
  try {
    // React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('  ✓ React detected');
    }
    // Vue DevTools
    if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('  ✓ Vue detected');
    }
    // Look for React Fiber
    const reactRoot = document.querySelector('[data-reactroot]') || 
                     document.querySelector('#root') ||
                     document.querySelector('[id^="app"]');
    if (reactRoot) {
      console.log('  ✓ Found React root:', reactRoot);
    }
  } catch (e) {
    console.log('  ⚠️ Error checking framework:', e);
  }
  
  // Debug: Monitor network requests (if we can)
  console.log('\n🌐 Network monitoring (check Network tab manually)...');
  console.log('  💡 TIP: Go to Network tab in DevTools and:');
  console.log('     1. Refresh the page');
  console.log('     2. Look for API calls to /api/, /v1/, /v2/, /memories/, etc.');
  console.log('     3. Check the response data');
  console.log('     4. Copy the response JSON and save as openmemory_export.json');
  
  // Try to intercept fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && (url.includes('memory') || url.includes('api'))) {
      console.log('  🔍 Fetch intercepted:', url);
      debugInfo.networkCalls.push(url);
    }
    return originalFetch.apply(this, args);
  };
  
  // Try common API patterns with authentication
  console.log('\n🔐 Trying authenticated API calls...');
  const token = localStorage.getItem('token') || 
               localStorage.getItem('authToken') ||
               localStorage.getItem('apiKey') ||
               sessionStorage.getItem('token') ||
               sessionStorage.getItem('authToken');
  
  if (token) {
    console.log('  ✓ Found token in storage');
    const apiEndpoints = [
      '/api/memories',
      '/api/v1/memories',
      '/api/v2/memories',
      '/memories',
      '/v1/memories',
      '/v2/memories'
    ];
    
    const baseUrl = window.location.origin;
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`  Trying: ${baseUrl}${endpoint}`);
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ SUCCESS! Found data at ${endpoint}`);
          console.log('  Data structure:', Object.keys(data));
          
          if (Array.isArray(data)) {
            memories.push(...data);
          } else if (data.memories && Array.isArray(data.memories)) {
            memories.push(...data.memories);
          } else if (data.results && Array.isArray(data.results)) {
            memories.push(...data.results);
          } else if (data.data && Array.isArray(data.data)) {
            memories.push(...data.data);
          }
          break;
        } else {
          console.log(`  ❌ ${response.status}: ${response.statusText}`);
        }
      } catch (e) {
        console.log(`  ⚠️ Error: ${e.message}`);
      }
    }
  } else {
    console.log('  ⚠️ No token found in storage');
  }
  
  // Remove duplicates
  const uniqueMemories = [];
  const seenIds = new Set();
  const seenContent = new Set();
  
  for (const memory of memories) {
    const id = memory.id || memory.content?.substring(0, 50);
    const contentHash = memory.content?.substring(0, 100);
    
    if (contentHash && !seenContent.has(contentHash)) {
      seenContent.add(contentHash);
      if (id) seenIds.add(id);
      uniqueMemories.push(memory);
    }
  }
  
  console.log(`\n✅ Extracted ${uniqueMemories.length} unique memories`);
  console.log('\n📊 Debug Summary:');
  console.log('  DOM elements found:', debugInfo.domElements.length);
  console.log('  Window variables found:', debugInfo.windowVars.length);
  console.log('  Network calls intercepted:', debugInfo.networkCalls.length);
  console.log('  Storage keys:', Object.keys(debugInfo.localStorage).length + Object.keys(debugInfo.sessionStorage).length);
  
  if (uniqueMemories.length === 0) {
    console.log('\n❌ No memories found automatically.');
    console.log('\n💡 Manual extraction options:');
    console.log('  1. Check Network tab for API calls when page loads');
    console.log('  2. Look for memory data in the page source');
    console.log('  3. Check if memories are loaded via WebSocket or SSE');
    console.log('  4. Try clicking through the UI to trigger data loads');
    console.log('  5. Check if there\'s an export feature in the dashboard');
  }
  
  // Export what we found
  const exportData = {
    success: uniqueMemories.length > 0,
    totalMemories: uniqueMemories.length,
    extractedAt: new Date().toISOString(),
    debugInfo: debugInfo,
    memories: uniqueMemories
  };
  
  // Download as JSON
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'openmemory_export_debug.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('📥 Downloaded openmemory_export_debug.json');
  console.log('\n📋 Next step:');
  if (uniqueMemories.length > 0) {
    console.log('   uv run python scripts/migrate_openmemory_to_byterover.py --import-file openmemory_export_debug.json');
  } else {
    console.log('   Check the debug info in the downloaded file');
    console.log('   Or manually extract memories from Network tab');
  }
  
  return uniqueMemories;
})();

