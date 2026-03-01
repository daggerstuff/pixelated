import { sanitizeUrl } from './sanitize';
import { CODE_REGEX, HEADING_REGEX, LINK_REGEX } from './constants';
import { escapeHtml } from './escapeHtml';

export function simpleMarkdownToHtml(text: string): string {
  return text
    .replace(HEADING_REGEX, (match, level) => `<h${level}>` + match.slice(1) + `</h${level}>`)
    .replace(CODE_REGEX, '<code>$1