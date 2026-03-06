export interface ThreatHunt { }
export interface InvestigationResult { }
export interface ThreatIndicator { }

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ThreatData {
	id: string
	timestamp: string
	source: string
	type: string
	severity: ThreatSeverity
	description: string
	raw_data: unknown
	processed_at: string
}

export interface ThreatPattern {
	id: string
	type: string
	source: string
	frequency: number
	first_seen: number
	last_seen: number
	confidence: number
	description: string
	related_threats: string[]
}

export interface ThreatFinding {
	id: string
	pattern_id: string
	title: string
	description: string
	severity: ThreatSeverity
	confidence: number
	related_threats: string[]
	created_at: string
	status: 'new' | 'investigating' | 'resolved' | 'dismissed'
}
