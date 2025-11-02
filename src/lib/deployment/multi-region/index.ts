/**
 * Multi-Region Deployment Infrastructure
 * Comprehensive multi-region deployment system for global scale
 */

export { MultiRegionDeploymentManager } from './MultiRegionDeploymentManager'
export { CloudProviderManager } from './CloudProviderManager'
export { EdgeComputingManager } from './EdgeComputingManager'
export { GlobalTrafficRoutingManager } from './GlobalTrafficRoutingManager'
export { CrossRegionDataSyncManager } from './CrossRegionDataSyncManager'
export { AutomatedFailoverOrchestrator } from './AutomatedFailoverOrchestrator'
export { ServiceDiscoveryManager } from './ServiceDiscoveryManager'
export { ConfigurationManager } from './ConfigurationManager'
export { HealthMonitor } from './HealthMonitor'
export { DeploymentOrchestrator } from './DeploymentOrchestrator'

// Types
export type {
  FailoverState,
  FailoverEvent,
  CircuitBreakerConfig,
  RegionMetrics,
} from './AutomatedFailoverOrchestrator'

export type { SyncStatus, DataDistribution } from './CrossRegionDataSyncManager'

export type {
  ServiceRegistration,
  ServiceInstance,
  DiscoveryOptions,
  ServiceStats,
  LoadBalancerConfig,
} from './ServiceDiscoveryManager'

export type {
  DeploymentConfig,
  DeploymentResult,
  RollbackConfig,
} from './DeploymentOrchestrator'

export type {
  HealthStatus,
  HealthCheck,
  HealthCheckResult,
} from './HealthMonitor'

export type {
  CloudProvider,
  RegionConfig,
  ResourceConfig,
} from './CloudProviderManager'

export type {
  EdgeNode,
  EdgeDeployment,
  EdgeConfig,
} from './EdgeComputingManager'

export type {
  RoutingRule,
  TrafficPolicy,
  LatencyTarget,
} from './GlobalTrafficRoutingManager'

export type {
  MultiRegionConfig,
  SyncConfig,
  DatabaseConfig,
} from './ConfigurationManager'

/**
 * Multi-Region Deployment System
 *
 * This module provides a comprehensive multi-region deployment infrastructure
 * with the following capabilities:
 *
 * 1. **Multi-Region Deployment Manager**: Orchestrates deployments across multiple cloud providers
 * 2. **Cloud Provider Manager**: Handles AWS, GCP, and Azure integrations
 * 3. **Edge Computing Manager**: Manages 50+ global edge locations
 * 4. **Global Traffic Routing**: Intelligent routing with latency optimization
 * 5. **Cross-Region Data Sync**: CockroachDB-based data synchronization
 * 6. **Automated Failover**: Health-based automatic failover orchestration
 * 7. **Service Discovery**: Multi-backend service registration and discovery
 * 8. **Configuration Management**: Centralized multi-region configuration
 * 9. **Health Monitoring**: Comprehensive health checking and alerting
 * 10. **Deployment Orchestration**: Coordinated deployment with rollback support
 *
 * ## Usage Example
 *
 * ```typescript
 * import {
 *   MultiRegionDeploymentManager,
 *   ConfigurationManager,
 *   HealthMonitor
 * } from './multi-region';
 *
 * // Initialize configuration
 * const config = new ConfigurationManager();
 * await config.initialize();
 *
 * // Initialize health monitor
 * const healthMonitor = new HealthMonitor(config);
 * await healthMonitor.initialize();
 *
 * // Initialize deployment manager
 * const deploymentManager = new MultiRegionDeploymentManager(config, healthMonitor);
 * await deploymentManager.initialize();
 *
 * // Deploy to multiple regions
 * const deploymentResult = await deploymentManager.deploy({
 *   regions: ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'],
 *   services: ['api', 'web', 'ai-service'],
 *   version: '1.0.0'
 * });
 *
 * console.log('Deployment completed:', deploymentResult);
 * ```
 *
 * ## Architecture Overview
 *
 * The system follows a modular architecture with clear separation of concerns:
 *
 * - **Orchestration Layer**: Coordinates deployment across regions
 * - **Provider Layer**: Abstracts cloud provider differences
 * - **Edge Layer**: Manages edge computing infrastructure
 * - **Data Layer**: Handles cross-region data synchronization
 * - **Network Layer**: Manages traffic routing and load balancing
 * - **Monitoring Layer**: Provides health monitoring and alerting
 * - **Failover Layer**: Handles automatic failover scenarios
 *
 * ## Key Features
 *
 * ### Multi-Cloud Support
 * - AWS, Google Cloud Platform, Azure
 * - Unified API across providers
 * - Provider-specific optimizations
 *
 * ### Global Edge Network
 * - 50+ edge locations worldwide
 * - Cloudflare Workers integration
 * - AWS Lambda@Edge support
 * - Containerized edge services
 *
 * ### Intelligent Traffic Routing
 * - Latency-based routing
 * - Geographic proximity routing
 * - Health-based routing
 * - Compliance-aware routing (GDPR, HIPAA)
 *
 * ### Data Synchronization
 * - CockroachDB for distributed data
 * - Real-time and batch sync modes
 * - Conflict resolution
 * - Data consistency guarantees
 *
 * ### Automated Failover
 * - Health-based failover triggers
 * - Circuit breaker patterns
 * - Graceful degradation
 * - Automatic recovery
 *
 * ### Service Discovery
 * - Consul, etcd, ZooKeeper support
 * - Multi-backend service registration
 * - Health-aware service discovery
 * - Load balancing integration
 *
 * ### Monitoring & Alerting
 * - Comprehensive health checks
 * - Real-time metrics collection
 * - Automated alerting
 * - Performance monitoring
 *
 * ## Configuration
 *
 * The system is highly configurable through environment variables and configuration files:
 *
 * ```bash
 * # Multi-region configuration
 * MULTI_REGION_ENABLED=true
 * PRIMARY_REGION=us-east-1
 * BACKUP_REGIONS=us-west-2,eu-central-1,ap-southeast-1
 *
 * # Cloud provider configuration
 * AWS_REGION=us-east-1
 * GCP_PROJECT_ID=pixelated-multi-region
 * AZURE_SUBSCRIPTION_ID=your-subscription-id
 *
 * # Service discovery configuration
 * CONSUL_ENABLED=true
 * ETCD_ENABLED=true
 * ZOOKEEPER_ENABLED=false
 *
 * # Database configuration
 * COCKROACHDB_ENABLED=true
 * MONGODB_ENABLED=true
 * REDIS_ENABLED=true
 *
 * # Monitoring configuration
 * HEALTH_CHECK_INTERVAL=30000
 * FAILOVER_THRESHOLD=50
 * ALERTING_ENABLED=true
 * ```
 *
 * ## Deployment
 *
 * Use the provided deployment script for automated multi-region deployment:
 *
 * ```bash
 * # Deploy to all regions
 * ./scripts/deploy/multi-region-deploy.sh --environment production
 *
 * # Deploy to specific regions
 * ./scripts/deploy/multi-region-deploy.sh --environment staging --regions us-east-1,eu-central-1
 *
 * # Deploy with custom configuration
 * ./scripts/deploy/multi-region-deploy.sh --environment production --config custom-config.json
 * ```
 *
 * ## Monitoring
 *
 * The system provides comprehensive monitoring capabilities:
 *
 * - **Health Dashboards**: Grafana dashboards for real-time monitoring
 * - **Metrics Collection**: Prometheus metrics for all components
 * - **Log Aggregation**: Centralized logging across all regions
 * - **Alerting**: Multi-channel alerting (Slack, email, PagerDuty)
 * - **Performance Monitoring**: Real-time performance metrics
 *
 * ## Security
 *
 * Security is built into every layer:
 *
 * - **Encryption**: TLS 1.3 for all communications
 * - **Authentication**: Multi-factor authentication
 * - **Authorization**: Role-based access control
 * - **Audit Logging**: Comprehensive audit trails
 * - **Compliance**: HIPAA, GDPR, SOC2 compliance
 * - **Network Security**: VPC isolation, security groups
 * - **Data Protection**: Encryption at rest and in transit
 *
 * ## Scaling
 *
 * The system is designed for horizontal scaling:
 *
 * - **Auto-scaling**: Based on CPU, memory, and custom metrics
 * - **Load Balancing**: Multi-tier load balancing
 * - **Database Sharding**: Automatic sharding for large datasets
 * - **Cache Distribution**: Distributed caching across regions
 * - **Edge Scaling**: Dynamic edge node provisioning
 *
 * ## Troubleshooting
 *
 * Common issues and solutions:
 *
 * ### Deployment Failures
 * - Check cloud provider credentials
 * - Verify network connectivity
 * - Review resource quotas
 * - Check configuration validity
 *
 * ### Service Discovery Issues
 * - Verify discovery backend connectivity
 * - Check service registration status
 * - Review health check configurations
 * - Validate network policies
 *
 * ### Data Sync Problems
 * - Check CockroachDB cluster health
 * - Verify replication lag
 * - Review conflict resolution logs
 * - Monitor sync queue status
 *
 * ### Failover Issues
 * - Check health monitor status
 * - Verify backup region health
 * - Review failover configuration
 * - Check DNS propagation
 *
 * ## Support
 *
 * For issues and questions:
 *
 * - **Documentation**: See `/docs` directory
 * - **Logs**: Check `/logs` directory
 * - **Monitoring**: Access Grafana dashboards
 * - **Community**: Join our Discord server
 * - **Issues**: Report on GitHub
 */

// Re-export everything for convenience
export * from './MultiRegionDeploymentManager'
export * from './CloudProviderManager'
export * from './EdgeComputingManager'
export * from './GlobalTrafficRoutingManager'
export * from './CrossRegionDataSyncManager'
export * from './AutomatedFailoverOrchestrator'
export * from './ServiceDiscoveryManager'
export * from './ConfigurationManager'
export * from './HealthMonitor'
export * from './DeploymentOrchestrator'

/**
 * Create a fully configured multi-region deployment system
 */
export async function createMultiRegionSystem(
  configOverrides?: Partial<MultiRegionConfig>,
) {
  const config = new ConfigurationManager()

  if (configOverrides) {
    await config.updateConfig(configOverrides)
  }

  await config.initialize()

  const healthMonitor = new HealthMonitor(config)
  await healthMonitor.initialize()

  const dataSyncManager = new CrossRegionDataSyncManager(config, healthMonitor)
  await dataSyncManager.initialize()

  const serviceDiscovery = new ServiceDiscoveryManager(config, healthMonitor)
  await serviceDiscovery.initialize()

  const failoverOrchestrator = new AutomatedFailoverOrchestrator(
    config,
    healthMonitor,
    dataSyncManager,
  )
  await failoverOrchestrator.initialize()

  const deploymentManager = new MultiRegionDeploymentManager(
    config,
    healthMonitor,
    dataSyncManager,
    serviceDiscovery,
    failoverOrchestrator,
  )
  await deploymentManager.initialize()

  return {
    config,
    healthMonitor,
    dataSyncManager,
    serviceDiscovery,
    failoverOrchestrator,
    deploymentManager,
  }
}

/**
 * Default export for convenience
 */
export default {
  MultiRegionDeploymentManager,
  CloudProviderManager,
  EdgeComputingManager,
  GlobalTrafficRoutingManager,
  CrossRegionDataSyncManager,
  AutomatedFailoverOrchestrator,
  ServiceDiscoveryManager,
  ConfigurationManager,
  HealthMonitor,
  DeploymentOrchestrator,
  createMultiRegionSystem,
}
