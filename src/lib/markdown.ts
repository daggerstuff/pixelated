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

  // Helper to escape HTML special characters
  const esc = (unsafe: string): string => unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 1️⃣ Replace links first, using the original (unescaped) text so URLs are unmodified.
  const afterLinks = text.replace(LINK_REGEX, (_, linkText: string, url: string) => {
    if (isSafeUrl(url)) {
      // Safe URL – escape the link text and embed the raw URL.
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(linkText)}</a>`;
    }
    // Unsafe URL – just escape the link text and wrap in a span.
    return `<span>${esc(linkText)}</span>`;
  });

  // 2️⃣ Process other markdown elements, escaping captured content before insertion.
  const afterBold = afterLinks.replace(BOLD_REGEX, (_, inner: string) => {
    return `<strong>${esc(inner)}</strong>`;
  });

  const afterItalic = afterBold.replace(ITALIC_REGEX, (_, inner: string) => {
    return `<em>${esc(inner)}</em>`;
  });

  const afterCode = afterItalic.replace(CODE_REGEX, (_, inner: string) => {
    return `<code>${esc(inner)}