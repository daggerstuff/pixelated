/**
 * Client-safe Markdown utility functions for basic parsing and manipulation.
 */

// Regular expressions for Markdown formatting
const BOLD_REGEX = /\*\*(.*?)\*\*/g;
const ITALIC_REGEX = /\*(.*?)\*/g;
const CODE_REGEX = /`(.*?)`/g;
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

/**
 * Escape HTML special characters to prevent XSS
 * @param unsafe Unsafe string
 * @returns Escaped string
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Check if a URL is safe to use in a link
 * @param url URL to check
 * @returns True if safe
 */
function isSafeUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase();
  // Block javascript: URLs
  if (normalizedUrl.startsWith("javascript:")) {
    return false;
  }
  // Allow common safe protocols and relative paths
  return (
    normalizedUrl.startsWith("http://") ||
    normalizedUrl.startsWith("https://") ||
    normalizedUrl.startsWith("mailto:") ||
    normalizedUrl.startsWith("tel:") ||
    normalizedUrl.startsWith("/") ||
    normalizedUrl.startsWith("./") ||
    normalizedUrl.startsWith("../") ||
    !normalizedUrl.includes(":")
  );
}

/**
 * Simple Markdown to HTML conversion for basic formatting
 * @param text Markdown text
 * @returns HTML with basic formatting
 */
export function simpleMarkdownToHtml(text: string): string {
  if (!text) {
    return "";
  }

  // Helper to escape user-generated text
  const esc = (s: string) => escapeHtml(s);

  // Safely replace links, validating URLs before they are used
  const processed = text.replace(LINK_REGEX, (match, linkText, url) => {
    if (isSafeUrl(url)) {
      // Use escaped URL in href, escape link text
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(linkText)}</a>`;
    }
    // Unsafe URL: just output the link text as a span
    return `<span>${esc(linkText)}</span>`;
  });

  // Apply other markdown transformations, escaping dynamic content
  return processed
    .replace(BOLD_REGEX, (_, content) => `<strong>${esc(content)}</strong>`)
    .replace(ITALIC_REGEX, (_, content) => `<em>${esc(content)}</em>`)
    .replace(CODE_REGEX, (_, content) => `<code>${esc(content)}