const fs = require('fs');
const content = fs.readFileSync('src/lib/security/phiDetection.ts', 'utf8');

const replacement = `  private fallbackRedaction(text: string, entities: PHIEntity[]): string {
    // Sort entities by start position in descending order to avoid position shifts
    const sortedEntities = [...entities].sort((a, b) => b.start - a.start)

    // Create a copy of the text to modify
    let redactedText = text

    // Replace each entity with context-aware redaction
    for (const entity of sortedEntities) {
      const type = entity.type
      let replacement = '[REDACTED]'

      switch (type) {
        case 'EMAIL_ADDRESS':
          replacement = '[EMAIL]'
          break
        case 'PHONE_NUMBER':
          replacement = '[PHONE]'
          break
        case 'US_SSN':
          replacement = '[ID]'
          break
        case 'PERSON':
          replacement = '[NAME]'
          break
      }

      redactedText =
        redactedText.substring(0, entity.start) +
        replacement +
        redactedText.substring(entity.end)
    }

    return redactedText
  }`;

const newContent = content.replace(
  /  private fallbackRedaction[\s\S]*?return redactedText\n  \}/,
  replacement
);

fs.writeFileSync('src/lib/security/phiDetection.ts', newContent);
