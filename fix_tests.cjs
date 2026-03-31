const fs = require('fs');

// Fix api-analyze.test.ts
const apiTestPath = 'src/lib/ai/bias-detection/__tests__/api-analyze.test.ts';
let apiTestContent = fs.readFileSync(apiTestPath, 'utf8');

apiTestContent = apiTestContent.replace(
  /const url = new URL\(\n\s+\`http:\/\/localhost:3000\/api\/bias-detection\/analyze\?sessionId=\\$\{mockSession\.sessionId\}\`,\n\s+\)/g,
  'const url = new URL(\n        `http://localhost:3000/api/bias-detection/analyze?therapistId=test-therapist`,\n      )'
);
apiTestContent = apiTestContent.replace(
  /const request = createMockGetRequest\({\n\s+sessionId: mockSession\.sessionId,\n\s+}\)/g,
  'const request = createMockGetRequest({\n        therapistId: \'test-therapist\',\n      })'
);
fs.writeFileSync(apiTestPath, apiTestContent);

// Fix pixel-multimodal.test.ts deprecation warnings
const wsTestPath = 'tests/api/websocket/pixel-multimodal.test.ts';
let wsTestContent = fs.readFileSync(wsTestPath, 'utf8');

// Replace done() callbacks with Promises
wsTestContent = wsTestContent.replace(/it\('([^']+)', \(done\) => {/g, 'it(\'$1\', () => new Promise<void>((resolve, reject) => {');
wsTestContent = wsTestContent.replace(/ws\.close\(\)\n\s+done\(\)/g, 'ws.close()\n        resolve()');
wsTestContent = wsTestContent.replace(/done\(new Error\(`WebSocket error: \$\{err\.message\}`\)\)/g, 'reject(new Error(`WebSocket error: ${err.message}`))');
wsTestContent = wsTestContent.replace(/it\('([^']+)', async \(done\) => {/g, 'it(\'$1\', async () => new Promise<void>((resolve, reject) => {');

// Remaining bare done() and done(err)
wsTestContent = wsTestContent.replace(/done\(\)/g, 'resolve()');
wsTestContent = wsTestContent.replace(/done\(([^)]+)\)/g, 'reject($1)');

fs.writeFileSync(wsTestPath, wsTestContent);
console.log("Fixes applied");
