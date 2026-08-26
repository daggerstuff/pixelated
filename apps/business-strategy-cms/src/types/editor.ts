export interface EditorContent {
  type: 'paragraph' | 'heading' | 'list' | 'image' | 'table' | 'quote' | 'code'
  content: string
  attributes?: Record<string, any>
  children?: EditorContent[]
}

export interface EditorState {
  content: EditorContent[]
  selection: {
    start: number
    end: number
  }
  isDirty: boolean
  lastSaved: Date | null
}

export interface EditorConfig {
  toolbar: string[]
  plugins: string[]
  autoSave: boolean
  autoSaveInterval: number
  maxFileSize: number
  allowedFileTypes: string[]
}

export interface MediaUpload {
  id: string
  url: string
  filename: string
  size: number
  type: string
  uploadedAt: Date
  uploadedBy: string
}

export interface EditorCommand {
  type: 'format' | 'insert' | 'delete' | 'replace'
  target: string
  value?: any
  position?: number
}

export interface CollaborationCursor {
  userId: string
  userName: string
  color: string
  position: number
  selection?: {
    start: number
    end: number
  }
}

export interface RealTimeUpdate {
  type: 'content' | 'cursor' | 'selection' | 'comment'
  userId: string
  documentId: string
  data: any
  timestamp: Date
}
