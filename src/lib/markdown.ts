import { JSDOM } from 'jsdom';

export function simpleMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const htmlLines: string[] = [];

  for (const line of lines) {
    // Check for headings (1-6 # markers)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      htmlLines.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Check for bold
    const boldMatch = line.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      htmlLines.push(`<strong>${boldMatch[1]}</strong>`);
      continue;
    }

    // Check for italic
    const italicMatch = line.match(/\*(.+?)\*/);
    if (italicMatch) {
      htmlLines.push(`<em>${italicMatch[1]}</em>`);
      continue;
    }

    // Check for code block
    if (line.startsWith('```')) {
      htmlLines.push('<pre><code>');
      continue;
    }

    // Check for inline code
    const codeMatch = line.match(/`(.+?)`/);
    if (codeMatch) {
      htmlLines.push(`<code>${codeMatch[1]}