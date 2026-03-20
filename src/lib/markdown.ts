export const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;
export const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

const MAX_INPUT_LENGTH = 100_000;

export function sanitizeUrl(url: string): string {
  // Reject protocol-relative URLs (//example.com)
  if (url.startsWith('//')) {
    return '#';
  }
  return url;
}

export function parseMarkdown(markdown: string): string {
  // Input size guard to prevent CPU pressure from large inputs
  if (markdown.length > MAX_INPUT_LENGTH) {
    throw new Error('Markdown input too large');
  }

  // Parse headings
  let result = markdown.replace(HEADING_REGEX, (match, level, headingText) => {
    const depth = level.length;
    return `<h${depth}>${headingText}</h${depth}>`;
  });

  // Parse links with URL sanitization
  result = result.replace(LINK_REGEX, (match, linkText, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<a href="${safeUrl}">${linkText}</a>`;
  });

  return result;
}