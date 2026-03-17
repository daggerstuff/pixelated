import { sanitizeUrl } from './sanitize';
import { CODE_REGEX, HEADING_REGEX, LINK_REGEX } from './constants';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function simpleMarkdownToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(HEADING_REGEX, (match, level) => `<h${level.length}>` + match.slice(level.length + 1) + `</h${level.length}>`)
    .replace(CODE_REGEX, '<code>$1</code>')
    .replace(LINK_REGEX, (match, linkText, url) => `<a href="${sanitizeUrl(url)}">${linkText}</a>`);
}