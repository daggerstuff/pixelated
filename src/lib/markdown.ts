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

  // Process headings first, escaping heading content
  let result = text.replace(HEADING_REGEX, (_, level, content) => {
    const headingLevel = Math.min(level.length, 6);
    const escapedContent = escapeHtml(content);
    return `<h${headingLevel}>${escapedContent}</h${headingLevel}>`;
  });

  // Process links, validating raw URLs before constructing HTML
  result = result.replace(LINK_REGEX, (match, linkText, url) => {
    if (isSafeUrl(url)) {
      const escapedLinkText = escapeHtml(linkText);
      const escapedUrl = escapeHtml(url);
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedLinkText}</a>`;
    }
    // If unsafe, return the link text escaped as a span
    return `<span>${escapeHtml(linkText)}</span>`;
  });

  // Process code spans, escaping the code content
  result = result.replace(CODE_REGEX, (match, code) => {
    const escapedCode = escapeHtml(code);
    return `<code>${escapedCode}