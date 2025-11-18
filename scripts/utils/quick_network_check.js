// Quick script to help identify OpenMemory API calls
// Run this in the browser console on app.openmemory.dev

console.log('🔍 OpenMemory Network Inspector');
console.log('================================');
console.log('');
console.log('Instructions:');
console.log('1. Open Network tab (F12 → Network)');
console.log('2. Clear the network log');
console.log('3. Refresh the page or navigate to memories');
console.log('4. Look for requests with:');
console.log('   - Type: xhr, fetch, json');
console.log('   - URL containing: memory, api, v1, v2, query');
console.log('   - Status: 200 (success)');
console.log('   - Large size (memory data)');
console.log('');
console.log('5. Click on promising requests');
console.log('6. Check Preview/Response tab for JSON data');
console.log('7. Copy the response JSON');
console.log('8. Save as openmemory_export.json');
console.log('');
console.log('💡 TIP: Filter by "XHR" or "Fetch" to see only API calls');
console.log('💡 TIP: Try scrolling or clicking "Load More" to trigger more requests');
