// Shared p5.js loading utility to prevent duplication across components
let p5Promise;

export default function loadP5() {
  if (!p5Promise) {
    p5Promise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('p5.js can only be loaded in the browser'));
        return;
      }
      if (window.p5) {
        resolve(window.p5);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/p5@2.0.3/lib/p5.min.js';
      script.onload = () => resolve(window.p5);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return p5Promise;
}