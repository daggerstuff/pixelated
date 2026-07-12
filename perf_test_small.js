const endpoints = Array.from({length: 5}, (_, i) => i);

async function testAllSettled() {
  const start = performance.now();
  for(let i=0; i<10000; i++) {
    await Promise.allSettled(endpoints.map(async (e) => e));
  }
  return performance.now() - start;
}

async function testAll() {
  const start = performance.now();
  for(let i=0; i<10000; i++) {
    await Promise.all(endpoints.map(async (e) => {
      try { return {value: e, status: 'fulfilled'}; }
      catch(err) { return {reason: err, status: 'rejected'}; }
    }));
  }
  return performance.now() - start;
}

async function run() {
  console.log("AllSettled:", await testAllSettled());
  console.log("All:", await testAll());
}
run();
