/**
 * Browser Console Script to Extract OpenMemory Memories
 * 
 * Instructions:
 * 1. Go to app.openmemory.dev and log in
 * 2. Navigate to your memories page
 * 3. Open browser developer tools (F12)
 * 4. Go to Console tab
 * 5. Copy and paste this script
 * 6. Run it
 * 7. The script will download openmemory_export.json
 */

(async function extractOpenMemoryMemories() {
    console.log('🔍 Starting OpenMemory memory extraction...');

    const memories = [];

    // Method 1: Try to find memories in DOM
    console.log('📋 Method 1: Looking for memories in page DOM...');
    const memorySelectors = [
        '[data-memory]',
        '[data-memory-id]',
        '.memory-item',
        '.memory-card',
        '.memory',
        '[class*="memory"]',
        '[id*="memory"]'
    ];

    for (const selector of memorySelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`  ✓ Found ${elements.length} elements with selector: ${selector}`);
            elements.forEach((el, index) => {
                const memory = {
                    id: el.dataset.id || el.dataset.memoryId || el.id || `memory-${index}`,
                    content: el.textContent?.trim() || el.innerText?.trim() || '',
                    // Try to extract additional fields
                    tags: el.dataset.tags ? JSON.parse(el.dataset.tags) : [],
                    category: el.dataset.category || el.dataset.type || '',
                };
                if (memory.content) {
                    memories.push(memory);
                }
            });
            break;
        }
    }

    // Method 2: Try to intercept API responses
    console.log('🌐 Method 2: Checking for API responses...');
    try {
        // Look for common API response patterns in the page
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
            const text = script.textContent || script.innerText || '';
            // Look for memory data in script tags
            const memoryMatches = text.match(/"memories"\s*:\s*\[(.*?)\]/s);
            if (memoryMatches) {
                console.log('  ✓ Found memories in script tag');
                try {
                    const data = JSON.parse(text.match(/{.*}/s)?.[0] || '{}');
                    if (data.memories && Array.isArray(data.memories)) {
                        memories.push(...data.memories);
                    }
                } catch (e) {
                    console.log('  ⚠️ Could not parse script data');
                }
            }
        }
    } catch (e) {
        console.log('  ⚠️ Error checking scripts:', e);
    }

    // Method 3: Try to access window/global variables
    console.log('🔍 Method 3: Checking window variables...');
    try {
        // Common variable names that might contain memory data
        const possibleVars = [
            'memories',
            'memoryData',
            'openMemory',
            'mem0',
            'memoryStore',
            'userMemories'
        ];

        for (const varName of possibleVars) {
            if (window[varName]) {
                console.log(`  ✓ Found window.${varName}`);
                const data = window[varName];
                if (Array.isArray(data)) {
                    memories.push(...data);
                } else if (data.memories && Array.isArray(data.memories)) {
                    memories.push(...data.memories);
                } else if (data.results && Array.isArray(data.results)) {
                    memories.push(...data.results);
                }
            }
        }
    } catch (e) {
        console.log('  ⚠️ Error checking window variables:', e);
    }

    // Method 4: Try to fetch from API directly (if we can find the endpoint)
    console.log('📡 Method 4: Trying to fetch from API...');
    try {
        // Common API endpoints
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
                const response = await fetch(`${baseUrl}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`  ✓ Successfully fetched from ${endpoint}`);
                    if (Array.isArray(data)) {
                        memories.push(...data);
                    } else if (data.memories && Array.isArray(data.memories)) {
                        memories.push(...data.memories);
                    } else if (data.results && Array.isArray(data.results)) {
                        memories.push(...data.results);
                    }
                    break;
                }
            } catch (e) {
                // Continue to next endpoint
            }
        }
    } catch (e) {
        console.log('  ⚠️ Error fetching from API:', e);
    }

    // Remove duplicates based on ID
    const uniqueMemories = [];
    const seenIds = new Set();
    for (const memory of memories) {
        const id = memory.id || memory.content?.substring(0, 50);
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            uniqueMemories.push(memory);
        }
    }

    console.log(`\n✅ Extracted ${uniqueMemories.length} unique memories`);

    // Format for export
    const exportData = {
        success: true,
        totalMemories: uniqueMemories.length,
        extractedAt: new Date().toISOString(),
        memories: uniqueMemories
    };

    // Download as JSON
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'openmemory_export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 Downloaded openmemory_export.json');
    console.log('\n📋 Next step:');
    console.log('   uv run python scripts/migrate_openmemory_to_byterover.py --import-file openmemory_export.json');

    return uniqueMemories;
})();

