import { sanitizeUrl } from './sanitize';
import { CODE_REGEX, HEADING_REGEX, LINK_REGEX } from './constants';

export function simpleMarkdownToHtml(text: string): string {
  // Escape HTML entities to prevent XSS before parsing markdown
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return escapedText
    .replace(HEADING_REGEX, (match, level) => `<h${level.length}>` + match.slice(level.length + 1) + `</h${level.length}>`)
    .replace(CODE_REGEX, '<code>$1</code>')
    .replace(LINK_REGEX, (match, textContent, url) => `<a href="${sanitizeUrl(url)}">${textContent}</a>`);
}