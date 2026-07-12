import { ComponentIntegrationService } from './src/lib/services/ComponentIntegrationService';

async function main() {
  const service = new ComponentIntegrationService('http://localhost:3000');

  // Mock fetch
  global.fetch = async (url) => {
    // simulate network latency
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      status: 200,
      ok: true
    } as any;
  };

  const start = performance.now();
  await service.getServiceHealth();
  const end = performance.now();

  console.log(`Execution time: ${end - start} ms`);
}

main().catch(console.error);
