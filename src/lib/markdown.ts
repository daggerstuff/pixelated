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
    .replace(HEADING_REGEX, (match, level, headingText) => `<h${level.length}>${headingText}</h${level.length}>`)
    .replace(CODE_REGEX, '<code>$1