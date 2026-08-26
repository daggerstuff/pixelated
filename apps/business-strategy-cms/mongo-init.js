// MongoDB initialization script
// This script runs when the MongoDB container is first created

// Switch to the business-strategy-cms database
use('business-strategy-cms')

// Create collections with validation
// Market data collection
db.createCollection('market_data', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['industry', 'market_size', 'timestamp'],
      properties: {
        industry: {
          bsonType: 'string',
          description: 'Industry identifier',
        },
        market_size: {
          bsonType: 'number',
          minimum: 0,
          description: 'Market size in USD',
        },
        growth_rate: {
          bsonType: 'number',
          description: 'Market growth rate as percentage',
        },
        competition_level: {
          bsonType: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Competition level (0-1)',
        },
        segments: {
          bsonType: 'array',
          description: 'Market segments data',
        },
        timestamp: {
          bsonType: 'date',
          description: 'Data collection timestamp',
        },
        source: {
          bsonType: 'string',
          description: 'Data source identifier',
        },
      },
    },
  },
})

// Competitor analysis collection
db.createCollection('competitor_analysis', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['competitors', 'market_leader', 'last_updated'],
      properties: {
        competitors: {
          bsonType: 'number',
          minimum: 0,
          description: 'Number of competitors',
        },
        market_leader: {
          bsonType: 'string',
          description: 'Market leader name',
        },
        avg_pricing: {
          bsonType: 'number',
          minimum: 0,
          description: 'Average pricing across competitors',
        },
        feature_frequency: {
          bsonType: 'object',
          description: 'Feature frequency analysis',
        },
        competitive_gaps: {
          bsonType: 'array',
          description: 'Identified competitive gaps',
        },
        last_updated: {
          bsonType: 'date',
          description: 'Last update timestamp',
        },
      },
    },
  },
})

// Business metrics collection
db.createCollection('business_metrics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['revenue', 'created_at'],
      properties: {
        revenue: {
          bsonType: 'number',
          minimum: 0,
          description: 'Revenue in USD',
        },
        growth_rate: {
          bsonType: 'number',
          description: 'Growth rate as percentage',
        },
        customer_acquisition_cost: {
          bsonType: 'number',
          minimum: 0,
          description: 'Customer acquisition cost',
        },
        customer_lifetime_value: {
          bsonType: 'number',
          minimum: 0,
          description: 'Customer lifetime value',
        },
        churn_rate: {
          bsonType: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Churn rate (0-1)',
        },
        net_promoter_score: {
          bsonType: 'number',
          minimum: -100,
          maximum: 100,
          description: 'Net Promoter Score (-100 to 100)',
        },
        market_share: {
          bsonType: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Market share (0-1)',
        },
        created_at: {
          bsonType: 'date',
          description: 'Creation timestamp',
        },
      },
    },
  },
})

// Create indexes for better performance
db.market_data.createIndex({ industry: 1, timestamp: -1 })
db.market_data.createIndex({ timestamp: -1 })
db.competitor_analysis.createIndex({ last_updated: -1 })
db.business_metrics.createIndex({ created_at: -1 })

// Insert sample data
db.market_data.insertMany([
  {
    industry: 'technology',
    market_size: 5000000000,
    growth_rate: 0.15,
    competition_level: 0.75,
    segments: [
      { name: 'SaaS', size: 2000000000, growth: 0.2 },
      { name: 'Cloud Services', size: 1500000000, growth: 0.18 },
      { name: 'AI/ML', size: 1000000000, growth: 0.25 },
    ],
    timestamp: new Date(),
    source: 'market_research_api',
  },
  {
    industry: 'healthcare',
    market_size: 8000000000,
    growth_rate: 0.12,
    competition_level: 0.6,
    segments: [
      { name: 'Digital Health', size: 2000000000, growth: 0.22 },
      { name: 'Telemedicine', size: 1000000000, growth: 0.3 },
      { name: 'Medical Devices', size: 3000000000, growth: 0.08 },
    ],
    timestamp: new Date(),
    source: 'healthcare_analytics',
  },
])

db.competitor_analysis.insertMany([
  {
    competitors: 25,
    market_leader: 'TechCorp Solutions',
    avg_pricing: 499.99,
    feature_frequency: {
      'real-time_collaboration': 0.85,
      'business_intelligence': 0.75,
      'workflow_automation': 0.65,
      'document_management': 0.9,
    },
    competitive_gaps: [
      'advanced_analytics',
      'predictive_modeling',
      'ai_insights',
    ],
    last_updated: new Date(),
  },
])

db.business_metrics.insertMany([
  {
    revenue: 1000000,
    growth_rate: 0.25,
    customer_acquisition_cost: 250,
    customer_lifetime_value: 2500,
    churn_rate: 0.05,
    net_promoter_score: 72,
    market_share: 0.08,
    created_at: new Date(),
  },
])

print('MongoDB initialization completed successfully!')
