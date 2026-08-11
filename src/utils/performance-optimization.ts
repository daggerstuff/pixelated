/**
 * Performance Optimization Utilities
 *
 * Utilities to reduce Core Web Vitals regressions: CLS prevention via
 * aspect-ratio hints on dimension-less media, and CSS containment for
 * rendering performance.
 */

/**
 * Optimizes CLS by setting explicit dimensions for media and placeholders
 */
export function optimizeCLS() {
  if (typeof document === "undefined") {
    return;
  }

  // Find images without dimensions and add styling to prevent layout shifts
  const images = document.querySelectorAll("img:not([width]):not([height])");
  images.forEach((img) => {
    (img as HTMLImageElement).style.aspectRatio = "16/9";
  });

  // Find iframes without dimensions
  const iframes = document.querySelectorAll("iframe:not([width]):not([height])");
  iframes.forEach((iframe) => {
    (iframe as HTMLIFrameElement).style.aspectRatio = "16/9";
  });
}

/**
 * Sets up CSS containment for improved rendering performance
 * @param selector CSS selector for elements to add containment to
 * @param containmentValue CSS containment value to use
 */
export function setupContainment(selector: string, containmentValue = "content"): void {
  if (typeof document === "undefined") {
    return;
  }

  const elements = document.querySelectorAll(selector);
  elements.forEach((el) => {
    (el as HTMLElement).style.contain = containmentValue;
  });
}
