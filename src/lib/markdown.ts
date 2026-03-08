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

  // Helper to escape dynamic content for HTML
  const esc = (s: string) => escapeHtml(s);

  // Start with the raw markdown text
  let processed = text;

  // 1. Process headings first
  processed = processed.replace(HEADING_REGEX, (_, level, content) => {
    const headingLevel = Math.min(level.length, 6);
    return `<h${headingLevel}>${esc(content)}</h${headingLevel}>`;
  });

  // 2. Process bold formatting
  processed = processed.replace(BOLD_REGEX, (match, content) => {
    return `<strong>${esc(content)}</strong>`;
  });

  // 3. Process italic formatting
  processed = processed.replace(ITALIC_REGEX, (match, content) => {
    return `<em>${esc(content)}</em>`;
  });

  // 4. Process inline code
  processed = processed.replace(CODE_REGEX, (match, content) => {
    return `<code>${esc(content)}