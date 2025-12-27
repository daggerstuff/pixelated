export interface EditorContent {
  html: string
  text: string
  markdown?: string
  wordCount: number
  readingTime: number
  structure: {
    headings: Array<{ level: number; text: string; id: string }>
    images: Array<{ src: string; alt: string; width?: number; height?: number }>
    tables: Array<{ rows: number; cols: number; caption?: string }>
    links: Array<{ href: string; text: string; title?: string }>
  }
}

export interface EditorConfig {
  toolbar: string[]
  plugins: string[]
  height: number
  menubar: boolean
  branding: boolean
  resize: boolean
  imageUploadUrl?: string
}

export class EditorService {
  static getDefaultConfig(): EditorConfig {
    return {
      toolbar: [
        'undo redo | bold italic underline strikethrough | fontselect fontsizeselect formatselect',
        'alignleft aligncenter alignright alignjustify | outdent indent | numlist bullist',
        'forecolor backcolor removeformat | pagebreak | charmap emoticons | fullscreen preview save print',
        'insertfile image media template link anchor codesample | ltr rtl',
        'table | hr pagebreak | subscript superscript | code codesample | help',
      ],
      plugins: [
        'advlist autolink lists link image charmap print preview anchor',
        'searchreplace visualblocks code fullscreen',
        'insertdatetime media table paste code help wordcount',
        'table hr pagebreak nonbreaking anchor toc insertdatetime advlist lists textcolor colorpicker textpattern',
      ],
      height: 500,
      menubar: true,
      branding: false,
      resize: true,
    }
  }

  static parseContent(html: string): EditorContent {
    // Simple parsing for now - will be enhanced with proper DOM parsing
    const text = html.replace(/<[^>]*>/g, '')
    const wordCount = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
    const readingTime = Math.ceil(wordCount / 200)

    return {
      html,
      text,
      wordCount,
      readingTime,
      structure: {
        headings: [],
        images: [],
        tables: [],
        links: [],
      },
    }
  }

  static sanitizeContent(html: string): string {
    // Basic HTML sanitization
    const allowedTags = [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'strike',
      'del',
      'ins',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
    ]

    // Remove script tags and other potentially dangerous content
    let sanitized = html.replace(/<script[^>]*>.*?<\/script>/gi, '')
    sanitized = sanitized.replace(/<style[^>]*>.*?<\/style>/gi, '')
    sanitized = sanitized.replace(/on\w+=\s*"[^"]*"/gi, '')
    sanitized = sanitized.replace(/on\w+=\s*'[^']*'/gi, '')
    sanitized = sanitized.replace(/javascript:/gi, '')

    return sanitized
  }

  static extractText(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
  }

  static calculateReadingTime(wordCount: number): number {
    return Math.ceil(wordCount / 200) // Average reading speed: 200 words per minute
  }

  static validateContent(html: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for empty content
    const text = this.extractText(html)
    if (!text.trim()) {
      errors.push('Content cannot be empty')
    }

    // Check for maximum content length (e.g., 100,000 characters)
    if (text.length > 100000) {
      errors.push('Content is too long (max 100,000 characters)')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
