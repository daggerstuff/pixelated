export interface WebSocketMessage {
    type: 'subscribe' | 'progress_update' | 'status_update' | 'error' | 'completion' | 'progress_request' | 'status_request'
    executionId: string
    timestamp: string
    data: any
}

export interface PipelineExecution {
    id: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    progress: number
    startTime?: string
    endTime?: string
    error?: string
}

export interface PipelineDataset {
    id: string
    name: string
    type: string
    size: number
}
