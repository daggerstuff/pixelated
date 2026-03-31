const fs = require('fs');

const apiTestPath = 'src/lib/ai/bias-detection/__tests__/api-analyze.test.ts';
let apiTestContent = fs.readFileSync(apiTestPath, 'utf8');

apiTestContent = apiTestContent.replace(
  /const url = new URL\(\n\s+`http:\/\/localhost:3000\/api\/bias-detection\/analyze\?therapistId=test-therapist`,\n\s+\)/g,
  'const url = new URL(\n        `http://localhost:3000/api/bias-detection/analyze?sessionId=\$\{mockSession.sessionId\}`,\n      )'
);
apiTestContent = apiTestContent.replace(
  /const request = createMockGetRequest\({\n\s+therapistId: \'test-therapist\',\n\s+}\)/g,
  'const request = createMockGetRequest({\n        sessionId: mockSession.sessionId,\n      })'
);

apiTestContent = apiTestContent.replace(/http:\/\/localhost:3000\/api\/bias-detection\/analyze\?sessionId=\$\{mockSession\.sessionId\}/g, 'http://localhost:3000/api/bias-detection/analyze?sessionId=\$\{mockSession.sessionId\}&therapistId=test-therapist');

fs.writeFileSync(apiTestPath, apiTestContent);
