// Minimal placeholder for documentation module
export function generateDocumentation() {
  // Return dummy doc for now
  return { doc: 'Generated documentation' }
}

export class DocumentationService {
  async generate(prompt: string) {
    return `Documentation for ${prompt}`
  }
}
