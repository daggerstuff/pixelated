import { sanitizeUrl } from './sanitize';
import { CODE_REGEX, HEADING_REGEX, LINK_REGEX } from './constants';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function simpleMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(HEADING_REGEX, (match, level) => `<h${level}>` + match.slice(1) + `</h${level}>`)
    .replace(CODE_REGEX, '<code>$1</code>')
    .replace(LINK_REGEX, (match, text, url) => `<a href="${sanitizeUrl(url)}">${text}</a>`);
}