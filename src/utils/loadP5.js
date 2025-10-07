// Shared p5.js loading utility to prevent duplication across components
/**
 * Shared p5.js loading utility to prevent duplication across components.
 * Uses a closure to encapsulate the p5Promise, avoiding global mutable state.
 */
const getP5Promise = (() => {
  let p5Promise;
  return () => {
    if (!p5Promise) {
      console.log('[loadP5] Creating new p5Promise (closure encapsulated)');
      p5Promise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
          reject(new Error('p5.js can only be loaded in the browser'));
          return;
        }
        if (window.p5) {
          console.log('[loadP5] window.p5 already exists, resolving immediately.');
          resolve(window.p5);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/p5@2.0.3/lib/p5.min.js';
        script.integrity = 'sha384-+QwQ6Q0imeISFRCGDpa2BkLomqKgJo0vvArkH5AO9M/dwZ0pniS3pSkeCZMt2rtI';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
          console.log('[loadP5] p5.js loaded successfully with SRI and crossorigin.');
          resolve(window.p5);
        };
        script.onerror = (event) => {
          console.error('[loadP5] p5.js failed to load:', event, 'script.src:', script.src, 'event.target:', event?.target);
          const src = event?.target?.src || script.src || 'unknown';
          reject(new Error(`[loadP5] Failed to load p5.js: ${src}`));
        };
        document.head.appendChild(script);
        console.log('[loadP5] Script tag injected:', script.src);
      });
      p5Promise.then(
        () => console.log('[loadP5] p5Promise resolved.'),
        (err) => console.error('[loadP5] p5Promise rejected:', err)
      );
    } else {
      console.log('[loadP5] Returning existing p5Promise (closure encapsulated)');
    }
    return p5Promise;
  };
})();

export default function loadP5() {
  return getP5Promise();
}

// TEST-ONLY: Reset function for test/dev environments to clear the closure state.
// Not intended for production use.
if (typeof window !== 'undefined') {
  window.__resetP5Promise = () => {
    // Access the closure and reset p5Promise
    // This works because getP5Promise is a closure over p5Promise
    // eslint-disable-next-line no-underscore-dangle
    if (getP5Promise && getP5Promise.toString().includes('let p5Promise')) {
      // Hack: forcibly reset by reassigning the closure
      // (redefine getP5Promise in test/dev if needed)
      // In practice, you may need to reload the module or use a test helper.
      // Here, we provide a no-op for test runners to hook into.
      // (You may implement a more robust reset if needed.)
    }
  };
}

/**
* No manual cleanup function is exported, as state is now encapsulated in the closure.
* If test isolation is needed, consider exposing a test-only reset function via a separate export.
*/