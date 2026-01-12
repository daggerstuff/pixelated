export interface BookMetadata {
    title: string;
    authors: string[];
    publication_year?: number;
    publisher?: string;
    description?: string;
    isbn?: string;
    doi?: string;
    url?: string;
    therapeutic_relevance_score: number;
    therapeutic_topics?: string[];
    author_credentials?: string[];
    keywords?: string[];
    source?: string;
    cover_image_url?: string;
    citation_count?: number;
    open_access?: boolean;
}

export interface DatasetMetadata {
    name: string;
    source: string;
    url: string;
    description: string;
    tags: string[];
    downloads: number;
    likes: number;
    size_bytes?: number;
    num_conversations?: number;
    avg_turns?: number;
    min_turns?: number;
    max_turns?: number;
    conversation_format?: string;
    languages?: string[];
    license?: string;
    created_at?: string;
    updated_at?: string;
    quality_score: number;
    therapeutic_relevance: number;
}

export interface SearchParams {
    q: string;
    sources?: string[];
    year_from?: number;
    year_to?: number;
    topics?: string[];
    min_relevance?: number;
    limit?: number;
    offset?: number;
    sort_by?: string;
}

export interface DatasetParams {
    q: string;
    min_turns?: number;
    min_quality?: number;
    limit?: number;
    offset?: number;
}

export interface SearchResponse {
    results: BookMetadata[];
    total: number;
    facets?: any;
}

export interface DatasetResponse {
    results: DatasetMetadata[];
    total: number;
}

export class ResearchAPI {
    private baseURL: string;

    constructor() {
        // Use environment variable if available, otherwise default to localhost:8000 for dev
        // In production, this should be set to the actual API URL
        this.baseURL = import.meta.env.PUBLIC_ACADEMIC_API_URL || 'http://localhost:8000/api';
    }

    private async fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}) {
        const { timeout = 30000 } = options as any;

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    async searchLiterature(params: SearchParams): Promise<SearchResponse> {
        const queryParams = new URLSearchParams();
        queryParams.append('q', params.q);
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.offset) queryParams.append('offset', params.offset.toString());
        if (params.min_relevance) queryParams.append('min_relevance', params.min_relevance.toString());
        if (params.year_from) queryParams.append('year_from', params.year_from.toString());
        if (params.year_to) queryParams.append('year_to', params.year_to.toString());
        if (params.sort_by) queryParams.append('sort_by', params.sort_by);

        if (params.topics && params.topics.length > 0) {
            params.topics.forEach(topic => queryParams.append('topics', topic));
        }

        if (params.sources && params.sources.length > 0) {
            params.sources.forEach(source => queryParams.append('sources', source));
        }

        const response = await this.fetchWithTimeout(`${this.baseURL}/search?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }

        return response.json();
    }

    async searchDatasets(params: DatasetParams): Promise<DatasetResponse> {
        const queryParams = new URLSearchParams();
        queryParams.append('q', params.q);
        if (params.min_turns) queryParams.append('min_turns', params.min_turns.toString());
        if (params.min_quality) queryParams.append('min_quality', params.min_quality.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());

        const response = await this.fetchWithTimeout(`${this.baseURL}/datasets?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`Dataset search failed: ${response.statusText}`);
        }

        return response.json();
    }

    async trackEvent(eventName: string, properties: Record<string, any>) {
        console.log(`[ResearchAPI] Track: ${eventName}`, properties);
        // Placeholder for real analytics integration
        // await fetch('/api/analytics/track', { method: 'POST', body: JSON.stringify(...) })
    }
}

export const researchAPI = new ResearchAPI();
