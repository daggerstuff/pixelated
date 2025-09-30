/**
 * Threat Correlation Engine
 * Cross-region threat analysis using ML algorithms for pattern recognition
 * Integrates with Pixelated's AI infrastructure for advanced correlation
 */

import { EventEmitter } from 'events';
import { MongoClient, Db, Collection } from 'mongodb';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';

import { auditLog } from '../audit-logging';

// Types
export interface ThreatCorrelation {
  id: string;
  timestamp: Date;
  correlation_type: 'temporal' | 'spatial' | 'behavioral' | 'attribution';
  confidence: number;
  threats: CorrelatedThreat[];
  patterns: ThreatPattern[];
  analysis: CorrelationAnalysis;
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface CorrelatedThreat {
  threat_id: string;
  region: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  indicators: ThreatIndicator[];
  timestamp: Date;
}

export interface ThreatIndicator {
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface ThreatPattern {
  pattern_id: string;
  pattern_type: string;
  description: string;
  confidence: number;
  frequency: number;
  temporal_span: number; // seconds
  spatial_span: number; // kilometers
  indicators: string[];
}

export interface CorrelationAnalysis {
  similarity_score: number;
  relationship_strength: number;
  common_attributes: string[];
  unique_attributes: string[];
  statistical_significance: number;
  machine_learning_insights: MLInsight[];
}

export interface MLInsight {
  algorithm: string;
  insight: string;
  confidence: number;
  evidence: string[];
}

export interface CorrelationEngineConfig {
  mongodb: {
    url: string;
    database: string;
  };
  redis: {
    url: string;
    password?: string;
  };
  algorithms: {
    temporal: AlgorithmConfig;
    spatial: AlgorithmConfig;
    behavioral: AlgorithmConfig;
    attribution: AlgorithmConfig;
  };
  thresholds: {
    min_correlation_confidence: number;
    min_similarity_score: number;
    max_correlation_distance: number;
    temporal_window: number; // seconds
  };
  performance: {
    batch_size: number;
    processing_interval: number;
    max_concurrent_correlations: number;
  };
}

export interface AlgorithmConfig {
  name: string;
  enabled: boolean;
  parameters: Record<string, any>;
  weight: number;
}

export class ThreatCorrelationEngine extends EventEmitter {
  private config: CorrelationEngineConfig;
  private mongoClient: MongoClient;
  private db: Db;
  private threatsCollection: Collection<any>;
  private correlationsCollection: Collection<ThreatCorrelation>;
  private redis: Redis;
  private isInitialized = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private correlationQueue: string[] = [];
  private isProcessing = false;

  constructor(config: CorrelationEngineConfig) {
    super();
    this.config = config;
    this.setMaxListeners(0);
  }

  /**
   * Initialize the threat correlation engine
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Correlation Engine');

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this.config.mongodb.url);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.config.mongodb.database);

      // Initialize collections
      this.threatsCollection = this.db.collection('threat_intelligence');
      this.correlationsCollection = this.db.collection('threat_correlations');

      // Create indexes for performance
      await this.createIndexes();

      // Initialize Redis connection
      this.redis = new Redis(this.config.redis.url, {
        password: this.config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });

      // Set up Redis pub/sub for real-time correlation
      await this.setupRedisPubSub();

      // Start background processing
      this.startCorrelationProcessing();

      this.isInitialized = true;
      logger.info('Threat Correlation Engine initialized successfully');

      this.emit('initialized', { timestamp: new Date() });
    } catch (error) {
      logger.error('Failed to initialize Threat Correlation Engine', { error: error.message });
      throw new Error(`Failed to initialize threat correlation engine: ${error.message}`);
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await Promise.all([
        // Threat intelligence indexes
        this.threatsCollection.createIndex({ id: 1 }),
        this.threatsCollection.createIndex({ region: 1, timestamp: -1 }),
        this.threatsCollection.createIndex({ type: 1, severity: 1 }),
        this.threatsCollection.createIndex({ 'indicators.value': 1 }),
        this.threatsCollection.createIndex({ location: '2dsphere' }),

        // Correlations indexes
        this.correlationsCollection.createIndex({ id: 1 }, { unique: true }),
        this.correlationsCollection.createIndex({ timestamp: -1 }),
        this.correlationsCollection.createIndex({ correlation_type: 1 }),
        this.correlationsCollection.createIndex({ confidence: -1 }),
        this.correlationsCollection.createIndex({ 'threats.threat_id': 1 }),
      ]);

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Failed to create database indexes', { error: error.message });
      throw error;
    }
  }

  /**
   * Set up Redis pub/sub for real-time correlation
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.connect();

      // Subscribe to new threat notifications
      await subscriber.subscribe('new-threat', async (message) => {
        try {
          const threatData = JSON.parse(message);
          await this.queueThreatForCorrelation(threatData.threat_id);
        } catch (error) {
          logger.error('Failed to process new threat notification', { error: error.message });
        }
      });

      logger.info('Redis pub/sub setup completed');
    } catch (error) {
      logger.error('Failed to setup Redis pub/sub', { error: error.message });
      throw error;
    }
  }

  /**
   * Queue threat for correlation analysis
   */
  async queueThreatForCorrelation(threatId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Threat correlation engine not initialized');
    }

    try {
      // Add to correlation queue
      this.correlationQueue.push(threatId);

      // Limit queue size to prevent memory issues
      if (this.correlationQueue.length > 1000) {
        this.correlationQueue = this.correlationQueue.slice(-500);
      }

      logger.debug('Threat queued for correlation', { threatId });
    } catch (error) {
      logger.error('Failed to queue threat for correlation', { error: error.message, threatId });
      throw error;
    }
  }

  /**
   * Start correlation processing service
   */
  private startCorrelationProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.correlationQueue.length > 0 && !this.isProcessing) {
        await this.processCorrelationQueue();
      }
    }, this.config.performance.processing_interval);
  }

  /**
   * Process correlation queue
   */
  private async processCorrelationQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      const batchSize = Math.min(
        this.correlationQueue.length,
        this.config.performance.batch_size
      );

      const threatIds = this.correlationQueue.splice(0, batchSize);
      logger.info('Processing correlation batch', { count: threatIds.length });

      // Get threat details
      const threats = await this.getThreatsByIds(threatIds);
      
      // Perform correlation analysis
      const correlations = await this.analyzeCorrelations(threats);

      // Store correlation results
      for (const correlation of correlations) {
        await this.storeCorrelation(correlation);
      }

      logger.info('Correlation batch processing completed', { 
        count: correlations.length 
      });

    } catch (error) {
      logger.error('Failed to process correlation queue', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get threats by IDs
   */
  private async getThreatsByIds(threatIds: string[]): Promise<any[]> {
    try {
      return await this.threatsCollection
        .find({ id: { $in: threatIds } })
        .toArray();
    } catch (error) {
      logger.error('Failed to get threats by IDs', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze correlations between threats
   */
  private async analyzeCorrelations(threats: any[]): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Temporal correlation
      if (this.config.algorithms.temporal.enabled) {
        const temporalCorrelations = await this.analyzeTemporalCorrelations(threats);
        correlations.push(...temporalCorrelations);
      }

      // Spatial correlation
      if (this.config.algorithms.spatial.enabled) {
        const spatialCorrelations = await this.analyzeSpatialCorrelations(threats);
        correlations.push(...spatialCorrelations);
      }

      // Behavioral correlation
      if (this.config.algorithms.behavioral.enabled) {
        const behavioralCorrelations = await this.analyzeBehavioralCorrelations(threats);
        correlations.push(...behavioralCorrelations);
      }

      // Attribution correlation
      if (this.config.algorithms.attribution.enabled) {
        const attributionCorrelations = await this.analyzeAttributionCorrelations(threats);
        correlations.push(...attributionCorrelations);
      }

      logger.info('Correlation analysis completed', { 
        total_correlations: correlations.length,
        temporal: correlations.filter(c => c.correlation_type === 'temporal').length,
        spatial: correlations.filter(c => c.correlation_type === 'spatial').length,
        behavioral: correlations.filter(c => c.correlation_type === 'behavioral').length,
        attribution: correlations.filter(c => c.correlation_type === 'attribution').length,
      });

      return correlations;
    } catch (error) {
      logger.error('Failed to analyze correlations', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze temporal correlations
   */
  private async analyzeTemporalCorrelations(threats: any[]): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Group threats by time windows
      const timeWindow = this.config.thresholds.temporal_window;
      const timeGroups = this.groupThreatsByTimeWindow(threats, timeWindow);

      for (const group of timeGroups) {
        if (group.threats.length < 2) continue;

        // Calculate temporal correlation metrics
        const correlation = this.calculateTemporalCorrelation(group.threats);
        
        if (correlation.confidence >= this.config.thresholds.min_correlation_confidence) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'temporal',
            confidence: correlation.confidence,
            threats: group.threats.map(t => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateTemporalRecommendations(correlation),
            metadata: {
              time_window: timeWindow,
              threat_count: group.threats.length,
              time_span: correlation.time_span,
            },
          });
        }
      }

      return correlations;
    } catch (error) {
      logger.error('Failed to analyze temporal correlations', { error: error.message });
      throw error;
    }
  }

  /**
   * Group threats by time windows
   */
  private groupThreatsByTimeWindow(threats: any[], windowSize: number): any[] {
    const groups: any[] = [];
    const sortedThreats = [...threats].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentGroup: any = null;

    for (const threat of sortedThreats) {
      const threatTime = new Date(threat.timestamp).getTime();

      if (!currentGroup || 
          threatTime - new Date(currentGroup.end_time).getTime() > windowSize * 1000) {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          start_time: threat.timestamp,
          end_time: threat.timestamp,
          threats: [threat],
        };
      } else {
        // Add to current group
        currentGroup.threats.push(threat);
        currentGroup.end_time = threat.timestamp;
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Calculate temporal correlation
   */
  private calculateTemporalCorrelation(threats: any[]): any {
    try {
      // Calculate time span
      const timestamps = threats.map(t => new Date(t.timestamp).getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const timeSpan = (maxTime - minTime) / 1000; // seconds

      // Calculate similarity score based on various factors
      let similarityScore = 0;
      let patterns: ThreatPattern[] = [];

      // Check for similar threat types
      const typeGroups = this.groupBy(threats, 'type');
      for (const [type, typeThreats] of Object.entries(typeGroups)) {
        if (typeThreats.length > 1) {
          similarityScore += 0.3;
          patterns.push({
            pattern_id: `temporal_type_${type}`,
            pattern_type: 'threat_type_clustering',
            description: `Multiple ${type} threats in temporal proximity`,
            confidence: 0.8,
            frequency: typeThreats.length,
            temporal_span: timeSpan,
            spatial_span: this.calculateSpatialSpan(typeThreats),
            indicators: [type],
          });
        }
      }

      // Check for similar indicators
      const allIndicators = threats.flatMap(t => t.indicators?.map((i: any) => i.value) || []);
      const indicatorCounts = this.countOccurrences(allIndicators);
      
      for (const [indicator, count] of Object.entries(indicatorCounts)) {
        if (count > 1) {
          similarityScore += 0.2;
          patterns.push({
            pattern_id: `temporal_indicator_${indicator}`,
            pattern_type: 'indicator_reuse',
            description: `Indicator ${indicator} appears in multiple threats`,
            confidence: 0.7,
            frequency: count,
            temporal_span: timeSpan,
            spatial_span: 0,
            indicators: [indicator],
          });
        }
      }

      // Calculate final confidence
      const confidence = Math.min(similarityScore, 1.0);

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: Object.keys(typeGroups).filter(type => typeGroups[type].length > 1),
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(threats.length, timeSpan),
          machine_learning_insights: [],
        },
        time_span,
      };
    } catch (error) {
      logger.error('Failed to calculate temporal correlation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze spatial correlations
   */
  private async analyzeSpatialCorrelations(threats: any[]): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Group threats by geographic proximity
      const spatialGroups = this.groupThreatsByProximity(threats);

      for (const group of spatialGroups) {
        if (group.threats.length < 2) continue;

        const correlation = this.calculateSpatialCorrelation(group.threats, group.distance);
        
        if (correlation.confidence >= this.config.thresholds.min_correlation_confidence) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'spatial',
            confidence: correlation.confidence,
            threats: group.threats.map(t => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateSpatialRecommendations(correlation),
            metadata: {
              max_distance: group.distance,
              threat_count: group.threats.length,
              geographic_span: correlation.geographic_span,
            },
          });
        }
      }

      return correlations;
    } catch (error) {
      logger.error('Failed to analyze spatial correlations', { error: error.message });
      throw error;
    }
  }

  /**
   * Group threats by geographic proximity
   */
  private groupThreatsByProximity(threats: any[]): any[] {
    const groups: any[] = [];
    const processed = new Set<string>();

    for (const threat of threats) {
      if (processed.has(threat.id)) continue;

      const group = {
        threats: [threat],
        distance: 0,
        center: threat.location?.coordinates || { latitude: 0, longitude: 0 },
      };

      // Find nearby threats
      for (const otherThreat of threats) {
        if (otherThreat.id === threat.id || processed.has(otherThreat.id)) continue;

        const distance = this.calculateDistance(
          threat.location?.coordinates,
          otherThreat.location?.coordinates
        );

        if (distance <= this.config.thresholds.max_correlation_distance) {
          group.threats.push(otherThreat);
          group.distance = Math.max(group.distance, distance);
          processed.add(otherThreat.id);
        }
      }

      if (group.threats.length > 1) {
        groups.push(group);
      }

      processed.add(threat.id);
    }

    return groups;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(coord1: any, coord2: any): number {
    if (!coord1 || !coord2) return Infinity;

    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate spatial correlation
   */
  private calculateSpatialCorrelation(threats: any[], maxDistance: number): any {
    try {
      // Calculate geographic span
      const coordinates = threats
        .map(t => t.location?.coordinates)
        .filter(coord => coord && coord.latitude && coord.longitude);

      let geographicSpan = 0;
      if (coordinates.length > 1) {
        for (let i = 0; i < coordinates.length; i++) {
          for (let j = i + 1; j < coordinates.length; j++) {
            const distance = this.calculateDistance(coordinates[i], coordinates[j]);
            geographicSpan = Math.max(geographicSpan, distance);
          }
        }
      }

      // Calculate similarity score
      let similarityScore = 0;
      let patterns: ThreatPattern[] = [];

      // Check for coordinated attacks (similar types in close proximity)
      const typeGroups = this.groupBy(threats, 'type');
      for (const [type, typeThreats] of Object.entries(typeGroups)) {
        if (typeThreats.length > 1) {
          similarityScore += 0.4;
          patterns.push({
            pattern_id: `spatial_type_${type}`,
            pattern_type: 'coordinated_attack',
            description: `Multiple ${type} threats in geographic proximity`,
            confidence: 0.9,
            frequency: typeThreats.length,
            temporal_span: this.calculateTemporalSpan(typeThreats),
            spatial_span: geographicSpan,
            indicators: [type],
          });
        }
      }

      // Check for indicator sharing across locations
      const allIndicators = threats.flatMap(t => t.indicators?.map((i: any) => i.value) || []);
      const indicatorCounts = this.countOccurrences(allIndicators);
      
      for (const [indicator, count] of Object.entries(indicatorCounts)) {
        if (count > 1) {
          similarityScore += 0.3;
          patterns.push({
            pattern_id: `spatial_indicator_${indicator}`,
            pattern_type: 'indicator_propagation',
            description: `Indicator ${indicator} spans multiple geographic locations`,
            confidence: 0.8,
            frequency: count,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: geographicSpan,
            indicators: [indicator],
          });
        }
      }

      const confidence = Math.min(similarityScore, 1.0);

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: Object.keys(typeGroups).filter(type => typeGroups[type].length > 1),
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(threats.length, geographicSpan),
          machine_learning_insights: [],
        },
        geographic_span: geographicSpan,
      };
    } catch (error) {
      logger.error('Failed to calculate spatial correlation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze behavioral correlations
   */
  private async analyzeBehavioralCorrelations(threats: any[]): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Group threats by behavioral patterns
      const behavioralGroups = this.groupThreatsByBehavior(threats);

      for (const group of behavioralGroups) {
        if (group.threats.length < 2) continue;

        const correlation = this.calculateBehavioralCorrelation(group.threats, group.pattern);
        
        if (correlation.confidence >= this.config.thresholds.min_correlation_confidence) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'behavioral',
            confidence: correlation.confidence,
            threats: group.threats.map(t => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateBehavioralRecommendations(correlation),
            metadata: {
              behavior_pattern: group.pattern,
              threat_count: group.threats.length,
              similarity_metrics: correlation.similarity_metrics,
            },
          });
        }
      }

      return correlations;
    } catch (error) {
      logger.error('Failed to analyze behavioral correlations', { error: error.message });
      throw error;
    }
  }

  /**
   * Group threats by behavioral patterns
   */
  private groupThreatsByBehavior(threats: any[]): any[] {
    const groups: any[] = [];

    // Define behavioral patterns to look for
    const behavioralPatterns = [
      'similar_tactics',
      'similar_tools',
      'similar_timing',
      'similar_targets',
      'escalation_pattern',
    ];

    for (const pattern of behavioralPatterns) {
      const grouped = this.groupThreatsByPattern(threats, pattern);
      groups.push(...grouped);
    }

    return groups;
  }

  /**
   * Group threats by specific pattern
   */
  private groupThreatsByPattern(threats: any[], pattern: string): any[] {
    const groups: any[] = [];

    switch (pattern) {
      case 'similar_tactics': {
        // Group by similar attack tactics
        const tacticGroups = this.groupBy(threats, 'tactics');
        for (const [tactic, tacticThreats] of Object.entries(tacticGroups)) {
          if (tacticThreats.length > 1) {
            groups.push({
              threats: tacticThreats,
              pattern: `similar_tactics_${tactic}`,
            });
          }
        }
        break;
      }

      case 'similar_tools': {
        // Group by similar tools/techniques
        const toolGroups = this.groupBy(threats, 'tools');
        for (const [tool, toolThreats] of Object.entries(toolGroups)) {
          if (toolThreats.length > 1) {
            groups.push({
              threats: toolThreats,
              pattern: `similar_tools_${tool}`,
            });
          }
        }
        break;
      }

      case 'escalation_pattern': {
        // Group by escalation patterns (increasing severity)
        const escalationGroups = this.identifyEscalationPatterns(threats);
        groups.push(...escalationGroups);
        break;
      }
    }

    return groups;
  }

  /**
   * Identify escalation patterns
   */
  private identifyEscalationPatterns(threats: any[]): any[] {
    const groups: any[] = [];
    const sortedThreats = [...threats].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Look for sequences of increasing severity
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    
    for (let i = 0; i < sortedThreats.length - 1; i++) {
      const sequence = [sortedThreats[i]];
      let currentSeverity = severityOrder[sortedThreats[i].severity as keyof typeof severityOrder] || 0;

      for (let j = i + 1; j < sortedThreats.length; j++) {
        const nextSeverity = severityOrder[sortedThreats[j].severity as keyof typeof severityOrder] || 0;
        
        if (nextSeverity > currentSeverity) {
          sequence.push(sortedThreats[j]);
          currentSeverity = nextSeverity;
        } else {
          break;
        }
      }

      if (sequence.length >= 3) {
        groups.push({
          threats: sequence,
          pattern: 'escalation_pattern',
        });
      }
    }

    return groups;
  }

  /**
   * Calculate behavioral correlation
   */
  private calculateBehavioralCorrelation(threats: any[], pattern: string): any {
    try {
      let similarityScore = 0;
      let patterns: ThreatPattern[] = [];
      let similarityMetrics: Record<string, number> = {};

      // Calculate similarity based on behavioral attributes
      switch (pattern) {
        case 'similar_tactics':
          similarityScore = 0.9; // High confidence for same tactics
          patterns.push({
            pattern_id: `behavioral_tactics_${pattern}`,
            pattern_type: 'behavioral_similarity',
            description: `Threats exhibit similar tactical approaches`,
            confidence: 0.9,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: ['tactics'],
          });
          break;

        case 'escalation_pattern':
          similarityScore = 0.95; // Very high confidence for escalation
          patterns.push({
            pattern_id: `behavioral_escalation_${pattern}`,
            pattern_type: 'escalation_pattern',
            description: `Threats show escalating severity pattern`,
            confidence: 0.95,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: ['severity_progression'],
          });
          similarityMetrics = {
            severity_increase_rate: this.calculateSeverityIncreaseRate(threats),
            time_between_escalations: this.calculateAverageTimeBetweenThreats(threats),
          };
          break;
      }

      const confidence = Math.min(similarityScore, 1.0);

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: [pattern],
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(threats.length, 0),
          machine_learning_insights: [],
        },
        similarity_metrics: similarityMetrics,
      };
    } catch (error) {
      logger.error('Failed to calculate behavioral correlation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze attribution correlations
   */
  private async analyzeAttributionCorrelations(threats: any[]): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Group threats by attribution attributes
      const attributionGroups = this.groupThreatsByAttribution(threats);

      for (const group of attributionGroups) {
        if (group.threats.length < 2) continue;

        const correlation = this.calculateAttributionCorrelation(group.threats, group.attribution);
        
        if (correlation.confidence >= this.config.thresholds.min_correlation_confidence) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'attribution',
            confidence: correlation.confidence,
            threats: group.threats.map(t => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateAttributionRecommendations(correlation),
            metadata: {
              attribution_data: group.attribution,
              threat_count: group.threats.length,
              confidence_factors: correlation.confidence_factors,
            },
          });
        }
      }

      return correlations;
    } catch (error) {
      logger.error('Failed to analyze attribution correlations', { error: error.message });
      throw error;
    }
  }

  /**
   * Group threats by attribution
   */
  private groupThreatsByAttribution(threats: any[]): any[] {
    const groups: any[] = [];

    // Group by attribution attributes
    const attributionFields = ['actor', 'campaign', 'motivation', 'sophistication', 'region'];
    
    for (const field of attributionFields) {
      const fieldGroups = this.groupBy(threats, `attribution.${field}`);
      for (const [value, valueThreats] of Object.entries(fieldGroups)) {
        if (value && valueThreats.length > 1) {
          groups.push({
            threats: valueThreats,
            attribution: { [field]: value },
          });
        }
      }
    }

    return groups;
  }

  /**
   * Calculate attribution correlation
   */
  private calculateAttributionCorrelation(threats: any[], attribution: any): any {
    try {
      let similarityScore = 0;
      let patterns: ThreatPattern[] = [];
      let confidenceFactors: Record<string, number> = {};

      // Calculate confidence based on attribution strength
      for (const [key, value] of Object.entries(attribution)) {
        if (value) {
          const factorScore = 0.8; // High confidence for attribution matches
          similarityScore += factorScore;
          confidenceFactors[key] = factorScore;

          patterns.push({
            pattern_id: `attribution_${key}_${value}`,
            pattern_type: 'attribution_match',
            description: `Threats share common ${key}: ${value}`,
            confidence: factorScore,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: [key],
          });
        }
      }

      const confidence = Math.min(similarityScore, 1.0);

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: Object.keys(attribution),
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(threats.length, 0),
          machine_learning_insights: [],
        },
        confidence_factors: confidenceFactors,
      };
    } catch (error) {
      logger.error('Failed to calculate attribution correlation', { error: error.message });
      throw error;
    }
  }

  /**
   * Utility functions
   */
  private groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((groups, item) => {
      const value = this.getNestedValue(item, key) || 'unknown';
      groups[value] = groups[value] || [];
      groups[value].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private countOccurrences(array: string[]): Record<string, number> {
    return array.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  private calculateTemporalSpan(threats: any[]): number {
    const timestamps = threats.map(t => new Date(t.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    return (maxTime - minTime) / 1000; // seconds
  }

  private calculateSpatialSpan(threats: any[]): number {
    const coordinates = threats
      .map(t => t.location?.coordinates)
      .filter(coord => coord && coord.latitude && coord.longitude);

    if (coordinates.length < 2) return 0;

    let maxDistance = 0;
    for (let i = 0; i < coordinates.length; i++) {
      for (let j = i + 1; j < coordinates.length; j++) {
        const distance = this.calculateDistance(coordinates[i], coordinates[j]);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    return maxDistance;
  }

  private calculateStatisticalSignificance(threatCount: number, span: number): number {
    // Simplified statistical significance calculation
    // In a real implementation, this would use proper statistical methods
    const baseSignificance = Math.min(threatCount / 10, 1.0);
    const spanFactor = span > 0 ? Math.min(1 / span, 1.0) : 1.0;
    return Math.min(baseSignificance * (1 + spanFactor), 1.0);
  }

  private calculateSeverityIncreaseRate(threats: any[]): number {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    let totalIncrease = 0;
    
    for (let i = 1; i < threats.length; i++) {
      const prevSeverity = severityOrder[threats[i - 1].severity as keyof typeof severityOrder] || 0;
      const currSeverity = severityOrder[threats[i].severity as keyof typeof severityOrder] || 0;
      totalIncrease += Math.max(0, currSeverity - prevSeverity);
    }
    
    return threats.length > 1 ? totalIncrease / (threats.length - 1) : 0;
  }

  private calculateAverageTimeBetweenThreats(threats: any[]): number {
    if (threats.length < 2) return 0;
    
    const timestamps = threats.map(t => new Date(t.timestamp).getTime()).sort();
    let totalTime = 0;
    
    for (let i = 1; i < timestamps.length; i++) {
      totalTime += timestamps[i] - timestamps[i - 1];
    }
    
    return totalTime / (timestamps.length - 1) / 1000; // seconds
  }

  private mapToCorrelatedThreat(threat: any): CorrelatedThreat {
    return {
      threat_id: threat.id,
      region: threat.region,
      location: threat.location?.name || threat.location,
      severity: threat.severity,
      confidence: threat.confidence,
      indicators: threat.indicators || [],
      timestamp: new Date(threat.timestamp),
    };
  }

  /**
   * Generate recommendations for different correlation types
   */
  private generateTemporalRecommendations(correlation: any): string[] {
    return [
      'Monitor for similar threats in the same time window',
      'Review security logs for the affected time period',
      'Consider temporal-based blocking rules',
      'Investigate potential coordinated attack campaigns',
    ];
  }

  private generateSpatialRecommendations(correlation: any): string[] {
    return [
      'Implement geographic-based access controls',
      'Monitor network traffic from affected regions',
      'Coordinate with regional security teams',
      'Consider location-based threat intelligence sharing',
    ];
  }

  private generateBehavioralRecommendations(correlation: any): string[] {
    return [
      'Update behavioral detection rules',
      'Monitor for similar attack patterns',
      'Implement user behavior analytics',
      'Review and update security policies',
    ];
  }

  private generateAttributionRecommendations(correlation: any): string[] {
    return [
      'Investigate attributed threat actor activities',
      'Share attribution intelligence with partners',
      'Implement actor-specific countermeasures',
      'Monitor for related campaign indicators',
    ];
  }

  /**
   * Store correlation result
   */
  private async storeCorrelation(correlation: ThreatCorrelation): Promise<void> {
    try {
      await this.correlationsCollection.insertOne({
        ...correlation,
        created_at: new Date(),
      });

      // Emit correlation event
      this.emit('correlation:detected', correlation);

      // Audit log
      await auditLog({
        action: 'threat_correlation',
        resource: `correlation:${correlation.id}`,
        details: {
          type: correlation.correlation_type,
          confidence: correlation.confidence,
          threat_count: correlation.threats.length,
        },
        userId: 'system',
        ip: 'internal',
      });

      logger.info('Correlation stored successfully', { 
        correlationId: correlation.id,
        type: correlation.correlation_type,
        confidence: correlation.confidence,
      });
    } catch (error) {
      logger.error('Failed to store correlation', { 
        error: error.message, 
        correlationId: correlation.id 
      });
      throw error;
    }
  }

  /**
   * Get correlations by type
   */
  async getCorrelationsByType(type: string, limit: number = 100): Promise<ThreatCorrelation[]> {
    try {
      return await this.correlationsCollection
        .find({ correlation_type: type })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get correlations by type', { error: error.message, type });
      throw error;
    }
  }

  /**
   * Get correlations by threat ID
   */
  async getCorrelationsByThreatId(threatId: string): Promise<ThreatCorrelation[]> {
    try {
      return await this.correlationsCollection
        .find({ 'threats.threat_id': threatId })
        .sort({ timestamp: -1 })
        .toArray();
    } catch (error) {
      logger.error('Failed to get correlations by threat ID', { error: error.message, threatId });
      throw error;
    }
  }

  /**
   * Search correlations
   */
  async searchCorrelations(query: {
    types?: string[];
    minConfidence?: number;
    startDate?: Date;
    endDate?: Date;
    regions?: string[];
    limit?: number;
  }): Promise<ThreatCorrelation[]> {
    try {
      const filter: any = {};

      if (query.types && query.types.length > 0) {
        filter.correlation_type = { $in: query.types };
      }

      if (query.minConfidence) {
        filter.confidence = { $gte: query.minConfidence };
      }

      if (query.startDate || query.endDate) {
        filter.timestamp = {};
        if (query.startDate) filter.timestamp.$gte = query.startDate;
        if (query.endDate) filter.timestamp.$lte = query.endDate;
      }

      if (query.regions && query.regions.length > 0) {
        filter['threats.region'] = { $in: query.regions };
      }

      return await this.correlationsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(query.limit || 100)
        .toArray();
    } catch (error) {
      logger.error('Failed to search correlations', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Get correlation statistics
   */
  async getCorrelationStats(): Promise<any> {
    try {
      const [
        totalCorrelations,
        typeDistribution,
        confidenceDistribution,
        recentCorrelations,
      ] = await Promise.all([
        this.correlationsCollection.countDocuments(),
        this.correlationsCollection.aggregate([
          { $group: { _id: '$correlation_type', count: { $sum: 1 } } },
        ]).toArray(),
        this.correlationsCollection.aggregate([
          {
            $bucket: {
              groupBy: '$confidence',
              boundaries: [0, 0.3, 0.6, 0.8, 1.0],
              default: 'other',
              output: { count: { $sum: 1 } },
            },
          },
        ]).toArray(),
        this.correlationsCollection
          .find({ timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
          .count(),
      ]);

      return {
        total_correlations: totalCorrelations,
        type_distribution: typeDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        confidence_distribution: confidenceDistribution,
        recent_correlations_24h: recentCorrelations,
      };
    } catch (error) {
      logger.error('Failed to get correlation statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Correlation Engine');

      if (this.processingInterval) {
        clearInterval(this.processingInterval);
      }

      await this.redis.quit();
      await this.mongoClient.close();

      this.isInitialized = false;
      this.emit('shutdown', { timestamp: new Date() });

      logger.info('Threat Correlation Engine shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  get isReady(): boolean {
    return this.isInitialized;
  }
}

export default ThreatCorrelationEngine;