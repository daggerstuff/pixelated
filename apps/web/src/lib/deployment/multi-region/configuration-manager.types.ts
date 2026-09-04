/**
 * Configuration manager types — extracted from ConfigurationManager.ts.
 */

import { EdgeDeploymentConfig } from './EdgeComputingManager'
import { RoutingConfig } from './GlobalTrafficRoutingManager'
import { DeploymentConfig, RegionConfig } from './MultiRegionDeploymentManager'

export interface MultiRegionConfig {
  deployment: DeploymentConfig
  edgeComputing: EdgeDeploymentConfig
  trafficRouting: RoutingConfig
  environments: {
    development: EnvironmentConfig
    staging: EnvironmentConfig
    production: EnvironmentConfig
  }
  featureFlags: FeatureFlags
  secrets: SecretConfig
  monitoring: MonitoringConfig
  compliance: ComplianceConfig
}

export interface EnvironmentConfig {
  regions: RegionConfig[]
  scaling: {
    autoScaling: boolean
    minInstances: number
    maxInstances: number
    targetCpuUtilization: number
    targetMemoryUtilization: number
  }
  resources: {
    cpu: string
    memory: string
    storage: string
  }
  networking: {
    vpcCidr: string
    subnetCidrs: string[]
    securityGroups: string[]
    loadBalancers: string[]
  }
  monitoring: {
    enabled: boolean
    samplingRate: number
    alertThresholds: Record<string, number>
  }
}

export interface FeatureFlags {
  multiRegionDeployment: boolean
  edgeComputing: boolean
  intelligentRouting: boolean
  autoFailover: boolean
  threatDetection: boolean
  biasDetection: boolean
  complianceChecking: boolean
  performanceMonitoring: boolean
  aiModelServing: boolean
  cacheOptimization: boolean
}

export interface SecretConfig {
  cloudProviders: {
    aws: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
    gcp: {
      projectId: string
      keyFilename: string
    }
    azure: {
      subscriptionId: string
      clientId: string
      clientSecret: string
      tenantId: string
    }
  }
  databases: {
    cockroachdb: {
      connectionString: string
      sslMode: string
    }
    redis: {
      url: string
      password: string
    }
  }
  aiServices: {
    openai: {
      apiKey: string
      organization: string
    }
    google: {
      apiKey: string
      projectId: string
    }
  }
  monitoring: {
    sentry: {
      dsn: string
      authToken: string
    }
    datadog: {
      apiKey: string
      appKey: string
    }
  }
}

export interface MonitoringConfig {
  metrics: {
    enabled: boolean
    interval: number
    retention: number
    aggregation: string
  }
  alerting: {
    enabled: boolean
    channels: string[]
    severityLevels: string[]
    escalationRules: Record<string, unknown>
  }
  logging: {
    level: string
    format: string
    destinations: string[]
    sampling: number
  }
}

export interface ComplianceConfig {
  gdpr: {
    enabled: boolean
    dataResidency: string[]
    retentionPeriods: Record<string, number>
    subjectRights: string[]
  }
  hipaa: {
    enabled: boolean
    encryptionRequired: boolean
    auditLogging: boolean
    accessControls: string[]
  }
  soc2: {
    enabled: boolean
    auditFrequency: string
    controls: string[]
  }
  pci: {
    enabled: boolean
    requirements: string[]
    scanningFrequency: string
  }
}

