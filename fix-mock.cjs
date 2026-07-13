const fs = require('fs');
const testFile = 'src/api/memory/__tests__/_shared.test.ts';
let testContent = fs.readFileSync(testFile, 'utf-8');

testContent = testContent.replace(/ProductMemoryGatewayError: class ProductMemoryGatewayError extends Error \{[\s\S]*\}\n\}\)\)/, `ProductMemoryGatewayError: class ProductMemoryGatewayError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
}))`);

fs.writeFileSync(testFile, testContent, 'utf-8');
