import { Logger } from '../../utils/logger'
import { ConfigurationManager } from './ConfigurationManager'
import { HealthMonitor } from './HealthMonitor'
import { EventEmitter } from 'events'
import { Consul, ConsulOptions } from 'consul'
import { Etcd3 } from 'etcd3'
import { ZooKeeperClient } from 'zookeeper'
import { DNSClient } from './DNSClient'
import { v4 as uuidv4 } from 'uuid'

/**
 * Service Discovery Manager
 * Manages service registration and discovery across multiple regions
 */
export class ServiceDiscoveryManager extends EventEmitter {
  private logger: Logger
  private config: ConfigurationManager
  private healthMonitor: HealthMonitor
  private consulClients: Map<string, Consul> = new Map()
  private etcdClients: Map<string, Etcd3> = new Map()
  private zookeeperClients: Map<string, ZooKeeperClient> = new Map()
  private dnsClient: DNSClient
  private serviceRegistry: Map<string, ServiceInstance[]> = new Map()
  private discoveryBackends: Map<string, DiscoveryBackend> = new Map()
  private isInitialized = false
  private heartbeatInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private serviceCache: Map<string, ServiceCacheEntry> = new Map()
  private loadBalancers: Map<string, LoadBalancer> = new Map()

  constructor(config: ConfigurationManager, healthMonitor: HealthMonitor) {
    super()
    this.config = config
    this.healthMonitor = healthMonitor
    this.logger = new Logger('ServiceDiscoveryManager')
    this.dnsClient = new DNSClient(config)
  }

  /**
   * Initialize the service discovery manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing ServiceDiscoveryManager...')

      // Initialize discovery backends
      await this.initializeDiscoveryBackends()

      // Initialize load balancers
      await this.initializeLoadBalancers()

      // Set up service registration
      await this.setupServiceRegistration()

      // Set up health checking
      await this.setupHealthChecking()

      // Start background processes
      this.startBackgroundProcesses()

      this.isInitialized = true
      this.logger.info('ServiceDiscoveryManager initialized successfully')

      this.emit('initialized')
    } catch (error) {
      this.logger.error('Failed to initialize ServiceDiscoveryManager', {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize discovery backends
   */
  private async initializeDiscoveryBackends(): Promise<void> {
    const regions = this.config.getRegions()
    const discoveryConfig = this.config.getServiceDiscoveryConfig()

    for (const region of regions) {
      try {
        // Initialize Consul
        if (discoveryConfig.consul?.enabled) {
          await this.initializeConsul(region, discoveryConfig.consul)
        }

        // Initialize etcd
        if (discoveryConfig.etcd?.enabled) {
          await this.initializeEtcd(region, discoveryConfig.etcd)
        }

        // Initialize ZooKeeper
        if (discoveryConfig.zookeeper?.enabled) {
          await this.initializeZookeeper(region, discoveryConfig.zookeeper)
        }

        this.logger.info(`Discovery backends initialized for region: ${region}`)
      } catch (error) {
        this.logger.error(
          `Failed to initialize discovery backends for region: ${region}`,
          { error },
        )
        throw error
      }
    }
  }

  /**
   * Initialize Consul client
   */
  private async initializeConsul(region: string, config: any): Promise<void> {
    try {
      const consulConfig: ConsulOptions = {
        host: config.host.replace('{region}', region),
        port: config.port,
        secure: config.secure,
        ca: config.caCert,
        defaults: {
          token: config.aclToken,
        },
      }

      const consul = new Consul(consulConfig)

      // Test connection
      await consul.agent.self()

      this.consulClients.set(region, consul)
      this.discoveryBackends.set(`${region}:consul`, {
        type: 'consul',
        client: consul,
        region,
      })

      this.logger.info(`Consul client initialized for region: ${region}`)
    } catch (error) {
      this.logger.error(`Failed to initialize Consul for region: ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize etcd client
   */
  private async initializeEtcd(region: string, config: any): Promise<void> {
    try {
      const etcd = new Etcd3({
        hosts: config.endpoints.map((endpoint: string) =>
          endpoint.replace('{region}', region),
        ),
        auth: {
          username: config.username,
          password: config.password,
        },
        tls: config.tls
          ? {
              ca: config.caCert,
              cert: config.clientCert,
              key: config.clientKey,
            }
          : undefined,
      })

      // Test connection
      await etcd.get('/').string()

      this.etcdClients.set(region, etcd)
      this.discoveryBackends.set(`${region}:etcd`, {
        type: 'etcd',
        client: etcd,
        region,
      })

      this.logger.info(`etcd client initialized for region: ${region}`)
    } catch (error) {
      this.logger.error(`Failed to initialize etcd for region: ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize ZooKeeper client
   */
  private async initializeZookeeper(
    region: string,
    config: any,
  ): Promise<void> {
    try {
      const zookeeper = new ZooKeeperClient({
        connect: config.connect.replace('{region}', region),
        timeout: config.timeout,
        debug_level: config.debugLevel,
      })

      await zookeeper.connect()

      this.zookeeperClients.set(region, zookeeper)
      this.discoveryBackends.set(`${region}:zookeeper`, {
        type: 'zookeeper',
        client: zookeeper,
        region,
      })

      this.logger.info(`ZooKeeper client initialized for region: ${region}`)
    } catch (error) {
      this.logger.error(
        `Failed to initialize ZooKeeper for region: ${region}`,
        { error },
      )
      throw error
    }
  }

  /**
   * Initialize load balancers
   */
  private async initializeLoadBalancers(): Promise<void> {
    const services = this.config.getServices()

    for (const service of services) {
      const loadBalancer = new LoadBalancer({
        serviceName: service.name,
        algorithm: service.loadBalancing || 'round-robin',
        healthCheck: service.healthCheck,
        circuitBreaker: service.circuitBreaker,
      })

      this.loadBalancers.set(service.name, loadBalancer)
    }

    this.logger.info(`Initialized ${this.loadBalancers.size} load balancers`)
  }

  /**
   * Set up service registration
   */
  private async setupServiceRegistration(): Promise<void> {
    // Register health checks for service discovery
    this.healthMonitor.registerCheck('service-discovery', async () => {
      try {
        const healthyBackends = await this.getHealthyBackends()
        const totalBackends = this.discoveryBackends.size

        if (healthyBackends.length === 0) {
          return {
            status: 'unhealthy',
            message: 'No healthy discovery backends',
          }
        }

        if (healthyBackends.length < totalBackends * 0.5) {
          return {
            status: 'degraded',
            message: `Only ${healthyBackends.length}/${totalBackends} backends healthy`,
          }
        }

        return {
          status: 'healthy',
          message: `${healthyBackends.length}/${totalBackends} backends healthy`,
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Service discovery check failed: ${error.message}`,
        }
      }
    })
  }

  /**
   * Get healthy discovery backends
   */
  private async getHealthyBackends(): Promise<DiscoveryBackend[]> {
    const healthyBackends: DiscoveryBackend[] = []

    for (const backend of this.discoveryBackends.values()) {
      try {
        const isHealthy = await this.checkBackendHealth(backend)
        if (isHealthy) {
          healthyBackends.push(backend)
        }
      } catch (error) {
        this.logger.warn(`Backend health check failed`, {
          backend: backend.type,
          region: backend.region,
          error,
        })
      }
    }

    return healthyBackends
  }

  /**
   * Check backend health
   */
  private async checkBackendHealth(
    backend: DiscoveryBackend,
  ): Promise<boolean> {
    try {
      switch (backend.type) {
        case 'consul': {
          const consul = backend.client as Consul
          await consul.agent.self()
          return true
        }
        case 'etcd': {
          const etcd = backend.client as Etcd3
          await etcd.get('/').string()
          return true
        }
        case 'zookeeper': {
          const zk = backend.client as ZooKeeperClient
          return zk.connected
        }
        default: {
          return false
        }
      }
    } catch (error) {
      return false
    }
  }

  /**
   * Set up health checking
   */
  private async setupHealthChecking(): Promise<void> {
    // Register health checks for registered services
    for (const [serviceName, instances] of this.serviceRegistry) {
      this.healthMonitor.registerCheck(`service-${serviceName}`, async () => {
        try {
          const healthyInstances = instances.filter(
            (instance) => instance.status === 'healthy',
          )
          const totalInstances = instances.length

          if (healthyInstances.length === 0) {
            return {
              status: 'unhealthy',
              message: `No healthy instances for ${serviceName}`,
            }
          }

          if (healthyInstances.length < totalInstances * 0.5) {
            return {
              status: 'degraded',
              message: `Only ${healthyInstances.length}/${totalInstances} instances healthy for ${serviceName}`,
            }
          }

          return {
            status: 'healthy',
            message: `${healthyInstances.length}/${totalInstances} instances healthy for ${serviceName}`,
          }
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `Service health check failed for ${serviceName}: ${error.message}`,
          }
        }
      })
    }
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    const config = this.config.getServiceDiscoveryConfig()

    // Start heartbeat process
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats().catch((error) => {
        this.logger.error('Heartbeat process failed', { error })
      })
    }, config.heartbeatInterval || 30000)

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredServices().catch((error) => {
        this.logger.error('Cleanup process failed', { error })
      })
    }, config.cleanupInterval || 300000)

    this.logger.info('Background processes started')
  }

  /**
   * Register a service instance
   */
  async registerService(service: ServiceRegistration): Promise<void> {
    try {
      this.logger.info('Registering service', {
        name: service.name,
        instance: service.instanceId,
        region: service.region,
      })

      // Create service instance
      const instance: ServiceInstance = {
        id: service.instanceId || uuidv4(),
        name: service.name,
        region: service.region,
        host: service.host,
        port: service.port,
        protocol: service.protocol || 'http',
        version: service.version || '1.0.0',
        metadata: service.metadata || {},
        status: 'healthy',
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        tags: service.tags || [],
      }

      // Register with all backends
      await this.registerWithBackends(instance)

      // Add to local registry
      if (!this.serviceRegistry.has(service.name)) {
        this.serviceRegistry.set(service.name, [])
      }

      const instances = this.serviceRegistry.get(service.name)!
      const existingIndex = instances.findIndex((i) => i.id === instance.id)

      if (existingIndex >= 0) {
        instances[existingIndex] = instance
      } else {
        instances.push(instance)
      }

      // Update load balancer
      const loadBalancer = this.loadBalancers.get(service.name)
      if (loadBalancer) {
        loadBalancer.updateInstances(instances)
      }

      this.logger.info('Service registered successfully', {
        name: service.name,
        instance: instance.id,
      })

      this.emit('serviceRegistered', instance)
    } catch (error) {
      this.logger.error('Failed to register service', { service, error })
      throw error
    }
  }

  /**
   * Register service with all discovery backends
   */
  private async registerWithBackends(instance: ServiceInstance): Promise<void> {
    const backends = await this.getHealthyBackends()

    const registrationPromises = backends.map((backend) =>
      this.registerWithBackend(backend, instance),
    )

    await Promise.allSettled(registrationPromises)
  }

  /**
   * Register service with specific backend
   */
  private async registerWithBackend(
    backend: DiscoveryBackend,
    instance: ServiceInstance,
  ): Promise<void> {
    try {
      switch (backend.type) {
        case 'consul': {
          await this.registerWithConsul(backend.client as Consul, instance)
          break
        }
        case 'etcd': {
          await this.registerWithEtcd(backend.client as Etcd3, instance)
          break
        }
        case 'zookeeper': {
          await this.registerWithZookeeper(
            backend.client as ZooKeeperClient,
            instance,
          )
          break
        }
      }
    } catch (error) {
      this.logger.error(`Failed to register with ${backend.type}`, {
        backend: backend.type,
        region: backend.region,
        instance: instance.id,
        error,
      })
      throw error
    }
  }

  /**
   * Register with Consul
   */
  private async registerWithConsul(
    consul: Consul,
    instance: ServiceInstance,
  ): Promise<void> {
    const service = {
      ID: instance.id,
      Name: instance.name,
      Tags: [...instance.tags, instance.region, `version:${instance.version}`],
      Address: instance.host,
      Port: instance.port,
      Meta: instance.metadata,
      Check: {
        HTTP: `${instance.protocol}://${instance.host}:${instance.port}/health`,
        Interval: '30s',
        Timeout: '5s',
        DeregisterCriticalServiceAfter: '2m',
      },
    }

    await consul.agent.service.register(service)
  }

  /**
   * Register with etcd
   */
  private async registerWithEtcd(
    etcd: Etcd3,
    instance: ServiceInstance,
  ): Promise<void> {
    const key = `/services/${instance.name}/${instance.region}/${instance.id}`
    const value = JSON.stringify({
      host: instance.host,
      port: instance.port,
      protocol: instance.protocol,
      version: instance.version,
      metadata: instance.metadata,
      tags: instance.tags,
      registeredAt: instance.registeredAt,
      status: instance.status,
    })

    // Set with TTL
    const lease = etcd.lease(60) // 60 second lease
    await lease.put(key).value(value)
    await lease.grant()
  }

  /**
   * Register with ZooKeeper
   */
  private async registerWithZookeeper(
    zk: ZooKeeperClient,
    instance: ServiceInstance,
  ): Promise<void> {
    const basePath = `/services/${instance.name}/${instance.region}`
    const instancePath = `${basePath}/${instance.id}`

    // Create parent paths if they don't exist
    await this.createZookeeperPath(zk, basePath)

    const data = JSON.stringify({
      host: instance.host,
      port: instance.port,
      protocol: instance.protocol,
      version: instance.version,
      metadata: instance.metadata,
      tags: instance.tags,
      registeredAt: instance.registeredAt,
      status: instance.status,
    })

    await zk.create(
      instancePath,
      Buffer.from(data),
      ZooKeeperClient.CreateMode.EPHEMERAL,
    )
  }

  /**
   * Create ZooKeeper path recursively
   */
  private async createZookeeperPath(
    zk: ZooKeeperClient,
    path: string,
  ): Promise<void> {
    const parts = path.split('/').filter((p) => p)
    let currentPath = ''

    for (const part of parts) {
      currentPath += `/${part}`
      try {
        await zk.create(
          currentPath,
          Buffer.from(''),
          ZooKeeperClient.CreateMode.PERSISTENT,
        )
      } catch (error: any) {
        if (error.code !== ZooKeeperClient.Exception.NODE_EXISTS) {
          throw error
        }
      }
    }
  }

  /**
   * Discover service instances
   */
  async discoverService(
    serviceName: string,
    options: DiscoveryOptions = {},
  ): Promise<ServiceInstance[]> {
    try {
      this.logger.debug('Discovering service', { serviceName, options })

      // Check cache first
      const cacheKey = this.getCacheKey(serviceName, options)
      const cached = this.serviceCache.get(cacheKey)

      if (cached && !this.isCacheExpired(cached)) {
        this.logger.debug('Returning cached service instances', {
          serviceName,
          count: cached.instances.length,
        })
        return cached.instances
      }

      // Discover from backends
      const instances = await this.discoverFromBackends(serviceName, options)

      // Filter instances
      const filteredInstances = this.filterInstances(instances, options)

      // Sort instances
      const sortedInstances = this.sortInstances(filteredInstances, options)

      // Cache results
      this.serviceCache.set(cacheKey, {
        instances: sortedInstances,
        timestamp: new Date(),
        ttl: options.cacheTTL || 30000, // 30 seconds default
      })

      this.logger.debug('Service discovery completed', {
        serviceName,
        total: instances.length,
        filtered: sortedInstances.length,
      })

      return sortedInstances
    } catch (error) {
      this.logger.error('Service discovery failed', {
        serviceName,
        options,
        error,
      })

      // Return cached results if available, even if expired
      const cacheKey = this.getCacheKey(serviceName, options)
      const cached = this.serviceCache.get(cacheKey)
      if (cached) {
        this.logger.warn('Returning expired cache due to discovery failure', {
          serviceName,
        })
        return cached.instances
      }

      throw error
    }
  }

  /**
   * Discover service instances from backends
   */
  private async discoverFromBackends(
    serviceName: string,
    options: DiscoveryOptions,
  ): Promise<ServiceInstance[]> {
    const backends = await this.getHealthyBackends()
    const discoveryPromises = backends.map((backend) =>
      this.discoverFromBackend(backend, serviceName, options),
    )

    const results = await Promise.allSettled(discoveryPromises)
    const instances: ServiceInstance[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        instances.push(...result.value)
      } else {
        this.logger.warn('Discovery from backend failed', {
          serviceName,
          error: result.reason,
        })
      }
    }

    return instances
  }

  /**
   * Discover from specific backend
   */
  private async discoverFromBackend(
    backend: DiscoveryBackend,
    serviceName: string,
    options: DiscoveryOptions,
  ): Promise<ServiceInstance[]> {
    try {
      switch (backend.type) {
        case 'consul': {
          return await this.discoverFromConsul(
            backend.client as Consul,
            serviceName,
            options,
          )
        }
        case 'etcd': {
          return await this.discoverFromEtcd(
            backend.client as Etcd3,
            serviceName,
            options,
          )
        }
        case 'zookeeper': {
          return await this.discoverFromZookeeper(
            backend.client as ZooKeeperClient,
            serviceName,
            options,
          )
        }
        default: {
          return []
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover from ${backend.type}`, {
        backend: backend.type,
        region: backend.region,
        serviceName,
        error,
      })
      throw error
    }
  }

  /**
   * Discover from Consul
   */
  private async discoverFromConsul(
    consul: Consul,
    serviceName: string,
    _options: DiscoveryOptions,
  ): Promise<ServiceInstance[]> {
    const services = await consul.health.service(serviceName)

    return services.map((service) => ({
      id: service.Service.ID,
      name: service.Service.Service,
      region: service.Node.Datacenter,
      host: service.Service.Address || service.Node.Address,
      port: service.Service.Port,
      protocol: 'http', // Default protocol
      version:
        service.Service.Tags?.find((tag) => tag.startsWith('version:'))?.split(
          ':',
        )[1] || '1.0.0',
      metadata: service.Service.Meta || {},
      status: service.Checks?.every((check) => check.Status === 'passing')
        ? 'healthy'
        : 'unhealthy',
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      tags: service.Service.Tags || [],
    }))
  }

  /**
   * Discover from etcd
   */
  private async discoverFromEtcd(
    etcd: Etcd3,
    serviceName: string,
    _options: DiscoveryOptions,
  ): Promise<ServiceInstance[]> {
    const keyPrefix = `/services/${serviceName}/`
    const response = await etcd.getAll().prefix(keyPrefix)

    const instances: ServiceInstance[] = []

    for (const [key, value] of Object.entries(response)) {
      try {
        const data = JSON.parse(value as string)
        const parts = key.split('/')
        const region = parts[parts.length - 2]
        const instanceId = parts[parts.length - 1]

        instances.push({
          id: instanceId,
          name: serviceName,
          region,
          host: data.host,
          port: data.port,
          protocol: data.protocol || 'http',
          version: data.version || '1.0.0',
          metadata: data.metadata || {},
          status: data.status || 'healthy',
          registeredAt: new Date(data.registeredAt),
          lastHeartbeat: new Date(),
          tags: data.tags || [],
        })
      } catch (error) {
        this.logger.warn('Failed to parse etcd service data', { key, error })
      }
    }

    return instances
  }

  /**
   * Discover from ZooKeeper
   */
  private async discoverFromZookeeper(
    zk: ZooKeeperClient,
    serviceName: string,
    _options: DiscoveryOptions,
  ): Promise<ServiceInstance[]> {
    const basePath = `/services/${serviceName}`
    const instances: ServiceInstance[] = []

    try {
      const regions = await zk.get_children(basePath)

      for (const region of regions) {
        const regionPath = `${basePath}/${region}`
        const instanceIds = await zk.get_children(regionPath)

        for (const instanceId of instanceIds) {
          try {
            const instancePath = `${regionPath}/${instanceId}`
            const data = await zk.get_data(instancePath)

            if (data) {
              const serviceData = JSON.parse(data.toString())

              instances.push({
                id: instanceId,
                name: serviceName,
                region,
                host: serviceData.host,
                port: serviceData.port,
                protocol: serviceData.protocol || 'http',
                version: serviceData.version || '1.0.0',
                metadata: serviceData.metadata || {},
                status: serviceData.status || 'healthy',
                registeredAt: new Date(serviceData.registeredAt),
                lastHeartbeat: new Date(),
                tags: serviceData.tags || [],
              })
            }
          } catch (error) {
            this.logger.warn('Failed to parse ZooKeeper service data', {
              instanceId,
              region,
              error,
            })
          }
        }
      }
    } catch (error: any) {
      if (error.code !== ZooKeeperClient.Exception.NO_NODE) {
        throw error
      }
    }

    return instances
  }

  /**
   * Filter instances based on options
   */
  private filterInstances(
    instances: ServiceInstance[],
    options: DiscoveryOptions,
  ): ServiceInstance[] {
    return instances.filter((instance) => {
      // Filter by region
      if (options.region && instance.region !== options.region) {
        return false
      }

      // Filter by version
      if (options.version && instance.version !== options.version) {
        return false
      }

      // Filter by status
      if (options.healthyOnly && instance.status !== 'healthy') {
        return false
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        const hasAllTags = options.tags.every((tag) =>
          instance.tags.includes(tag),
        )
        if (!hasAllTags) return false
      }

      // Filter by metadata
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          if (instance.metadata[key] !== value) {
            return false
          }
        }
      }

      return true
    })
  }

  /**
   * Sort instances based on options
   */
  private sortInstances(
    instances: ServiceInstance[],
    options: DiscoveryOptions,
  ): ServiceInstance[] {
    const sorted = [...instances]

    switch (options.sortBy) {
      case 'region':
        sorted.sort((a, b) => a.region.localeCompare(b.region))
        break
      case 'version':
        sorted.sort((a, b) => a.version.localeCompare(b.version))
        break
      case 'health':
        sorted.sort((a, b) => {
          if (a.status === 'healthy' && b.status !== 'healthy') return -1
          if (a.status !== 'healthy' && b.status === 'healthy') return 1
          return 0
        })
        break
      default:
        // Default: sort by registration time (newest first)
        sorted.sort(
          (a, b) => b.registeredAt.getTime() - a.registeredAt.getTime(),
        )
    }

    return sorted
  }

  /**
   * Get cache key
   */
  private getCacheKey(serviceName: string, options: DiscoveryOptions): string {
    const keyParts = [serviceName]

    if (options.region) keyParts.push(`region:${options.region}`)
    if (options.version) keyParts.push(`version:${options.version}`)
    if (options.healthyOnly) keyParts.push('healthyOnly')
    if (options.tags && options.tags.length > 0)
      keyParts.push(`tags:${options.tags.join(',')}`)
    if (options.sortBy) keyParts.push(`sort:${options.sortBy}`)

    return keyParts.join('|')
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(entry: ServiceCacheEntry): boolean {
    const now = new Date().getTime()
    const entryTime = entry.timestamp.getTime()
    return now - entryTime > entry.ttl
  }

  /**
   * Send heartbeats for registered services
   */
  private async sendHeartbeats(): Promise<void> {
    try {
      const backends = await this.getHealthyBackends()

      for (const [_serviceName, instances] of this.serviceRegistry) {
        for (const instance of instances) {
          if (instance.status === 'healthy') {
            instance.lastHeartbeat = new Date()

            // Send heartbeat to backends
            const heartbeatPromises = backends.map((backend) =>
              this.sendHeartbeatToBackend(backend, instance),
            )

            await Promise.allSettled(heartbeatPromises)
          }
        }
      }
    } catch (error) {
      this.logger.error('Heartbeat process failed', { error })
    }
  }

  /**
   * Send heartbeat to backend
   */
  private async sendHeartbeatToBackend(
    backend: DiscoveryBackend,
    instance: ServiceInstance,
  ): Promise<void> {
    try {
      switch (backend.type) {
        case 'consul': {
          // Consul handles heartbeats automatically via TTL checks
          break
        }
        case 'etcd': {
          // Update lease for etcd
          const etcd = backend.client as Etcd3
          const key = `/services/${instance.name}/${instance.region}/${instance.id}`
          await etcd.get(key).string() // Touch the key to renew lease
          break
        }
        case 'zookeeper': {
          // ZooKeeper ephemeral nodes handle heartbeats automatically
          break
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to send heartbeat to ${backend.type}`, {
        backend: backend.type,
        region: backend.region,
        instance: instance.id,
        error,
      })
    }
  }

  /**
   * Cleanup expired services
   */
  private async cleanupExpiredServices(): Promise<void> {
    try {
      const now = new Date()
      const maxAge = 5 * 60 * 1000 // 5 minutes

      for (const [serviceName, instances] of this.serviceRegistry) {
        const validInstances = instances.filter((instance) => {
          const age = now.getTime() - instance.lastHeartbeat.getTime()
          return age < maxAge
        })

        const removedCount = instances.length - validInstances.length

        if (removedCount > 0) {
          this.logger.info(
            `Removed ${removedCount} expired instances for ${serviceName}`,
          )
          this.serviceRegistry.set(serviceName, validInstances)

          // Update load balancer
          const loadBalancer = this.loadBalancers.get(serviceName)
          if (loadBalancer) {
            loadBalancer.updateInstances(validInstances)
          }
        }
      }

      // Clear expired cache entries
      for (const [key, entry] of this.serviceCache) {
        if (this.isCacheExpired(entry)) {
          this.serviceCache.delete(key)
        }
      }
    } catch (error) {
      this.logger.error('Cleanup process failed', { error })
    }
  }

  /**
   * Get service instance using load balancer
   */
  async getServiceInstance(
    serviceName: string,
    options: DiscoveryOptions = {},
  ): Promise<ServiceInstance | null> {
    try {
      const instances = await this.discoverService(serviceName, options)

      if (instances.length === 0) {
        return null
      }

      const loadBalancer = this.loadBalancers.get(serviceName)
      if (!loadBalancer) {
        // Return first healthy instance if no load balancer
        return instances.find((i) => i.status === 'healthy') || null
      }

      return loadBalancer.selectInstance(instances, options)
    } catch (error) {
      this.logger.error('Failed to get service instance', {
        serviceName,
        options,
        error,
      })
      throw error
    }
  }

  /**
   * Watch for service changes
   */
  async watchService(
    serviceName: string,
    callback: (instances: ServiceInstance[]) => void,
    options: DiscoveryOptions = {},
  ): Promise<() => void> {
    try {
      this.logger.info('Starting service watch', { serviceName, options })

      let isWatching = true
      const watchInterval = options.watchInterval || 10000 // 10 seconds default

      const watchLoop = async () => {
        if (!isWatching) return

        try {
          const instances = await this.discoverService(serviceName, options)
          callback(instances)
        } catch (error) {
          this.logger.error('Service watch error', { serviceName, error })
        }

        if (isWatching) {
          setTimeout(watchLoop, watchInterval)
        }
      }

      // Start watching
      watchLoop()

      // Return stop function
      return () => {
        isWatching = false
        this.logger.info('Service watch stopped', { serviceName })
      }
    } catch (error) {
      this.logger.error('Failed to start service watch', {
        serviceName,
        options,
        error,
      })
      throw error
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats(serviceName?: string): Promise<ServiceStats> {
    try {
      const stats: ServiceStats = {
        totalServices: 0,
        totalInstances: 0,
        healthyInstances: 0,
        unhealthyInstances: 0,
        services: {},
      }

      const servicesToCheck = serviceName
        ? [[serviceName, this.serviceRegistry.get(serviceName) || []]]
        : Array.from(this.serviceRegistry.entries())

      for (const [name, instances] of servicesToCheck) {
        const healthy = instances.filter((i) => i.status === 'healthy').length
        const unhealthy = instances.filter((i) => i.status !== 'healthy').length

        stats.services[name] = {
          totalInstances: instances.length,
          healthyInstances: healthy,
          unhealthyInstances: unhealthy,
          regions: [...new Set(instances.map((i) => i.region))],
        }

        stats.totalInstances += instances.length
        stats.healthyInstances += healthy
        stats.unhealthyInstances += unhealthy
      }

      stats.totalServices = Object.keys(stats.services).length

      return stats
    } catch (error) {
      this.logger.error('Failed to get service statistics', {
        serviceName,
        error,
      })
      throw error
    }
  }

  /**
   * Deregister a service instance
   */
  async deregisterService(
    serviceName: string,
    instanceId: string,
  ): Promise<void> {
    try {
      this.logger.info('Deregistering service', { serviceName, instanceId })

      // Remove from backends
      const backends = await this.getHealthyBackends()
      const deregistrationPromises = backends.map((backend) =>
        this.deregisterFromBackend(backend, serviceName, instanceId),
      )

      await Promise.allSettled(deregistrationPromises)

      // Remove from local registry
      const instances = this.serviceRegistry.get(serviceName)
      if (instances) {
        const filteredInstances = instances.filter((i) => i.id !== instanceId)
        this.serviceRegistry.set(serviceName, filteredInstances)

        // Update load balancer
        const loadBalancer = this.loadBalancers.get(serviceName)
        if (loadBalancer) {
          loadBalancer.updateInstances(filteredInstances)
        }
      }

      // Clear cache
      for (const [key, entry] of this.serviceCache) {
        if (key.startsWith(serviceName)) {
          const filteredInstances = entry.instances.filter(
            (i) => i.id !== instanceId,
          )
          this.serviceCache.set(key, {
            ...entry,
            instances: filteredInstances,
          })
        }
      }

      this.logger.info('Service deregistered successfully', {
        serviceName,
        instanceId,
      })

      this.emit('serviceDeregistered', { serviceName, instanceId })
    } catch (error) {
      this.logger.error('Failed to deregister service', {
        serviceName,
        instanceId,
        error,
      })
      throw error
    }
  }

  /**
   * Deregister from backend
   */
  private async deregisterFromBackend(
    backend: DiscoveryBackend,
    serviceName: string,
    instanceId: string,
  ): Promise<void> {
    try {
      switch (backend.type) {
        case 'consul': {
          const consul = backend.client as Consul
          await consul.agent.service.deregister(instanceId)
          break
        }
        case 'etcd': {
          const etcd = backend.client as Etcd3
          const key = `/services/${serviceName}/${backend.region}/${instanceId}`
          await etcd.delete().key(key)
          break
        }
        case 'zookeeper': {
          const zk = backend.client as ZooKeeperClient
          const path = `/services/${serviceName}/${backend.region}/${instanceId}`
          await zk.delete(path, -1)
          break
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to deregister from ${backend.type}`, {
        backend: backend.type,
        region: backend.region,
        serviceName,
        instanceId,
        error,
      })
    }
  }

  /**
   * Shutdown the service discovery manager
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down ServiceDiscoveryManager...')

      // Clear intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
        this.heartbeatInterval = null
      }

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }

      // Deregister all services
      for (const [serviceName, instances] of this.serviceRegistry) {
        for (const instance of instances) {
          try {
            await this.deregisterService(serviceName, instance.id)
          } catch (error) {
            this.logger.warn('Failed to deregister service during shutdown', {
              serviceName,
              instance: instance.id,
              error,
            })
          }
        }
      }

      // Close backend connections
      for (const [region, _consul] of this.consulClients) {
        // Consul doesn't have a close method
        this.logger.info(`Consul connection closed for region: ${region}`)
      }

      for (const [region, etcd] of this.etcdClients) {
        await etcd.close()
        this.logger.info(`etcd connection closed for region: ${region}`)
      }

      for (const [region, zk] of this.zookeeperClients) {
        await zk.close()
        this.logger.info(`ZooKeeper connection closed for region: ${region}`)
      }

      this.consulClients.clear()
      this.etcdClients.clear()
      this.zookeeperClients.clear()
      this.discoveryBackends.clear()

      this.isInitialized = false
      this.logger.info('ServiceDiscoveryManager shutdown completed')

      this.emit('shutdown')
    } catch (error) {
      this.logger.error('Error during shutdown', { error })
      throw error
    }
  }
}

/**
 * Load Balancer implementation
 */
class LoadBalancer {
  private serviceName: string
  private algorithm: string
  private healthCheck: any
  private circuitBreaker: any
  private currentIndex = 0
  private instanceWeights: Map<string, number> = new Map()

  constructor(config: LoadBalancerConfig) {
    this.serviceName = config.serviceName
    this.algorithm = config.algorithm
    this.healthCheck = config.healthCheck
    this.circuitBreaker = config.circuitBreaker
  }

  selectInstance(
    instances: ServiceInstance[],
    options: DiscoveryOptions = {},
  ): ServiceInstance | null {
    const healthyInstances = instances.filter((i) => i.status === 'healthy')

    if (healthyInstances.length === 0) {
      return null
    }

    switch (this.algorithm) {
      case 'round-robin':
        return this.roundRobin(healthyInstances)

      case 'weighted-round-robin':
        return this.weightedRoundRobin(healthyInstances)

      case 'least-connections':
        return this.leastConnections(healthyInstances)

      case 'random':
        return this.random(healthyInstances)

      case 'geo-proximity':
        return this.geoProximity(healthyInstances, options.clientRegion)

      default:
        return healthyInstances[0]
    }
  }

  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.currentIndex % instances.length]
    this.currentIndex++
    return instance
  }

  private weightedRoundRobin(instances: ServiceInstance[]): ServiceInstance {
    // Simple weighted round-robin implementation
    // In production, use more sophisticated algorithms
    return this.roundRobin(instances)
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    // Return instance with least connections
    // This would typically use connection metrics
    return instances[0]
  }

  private random(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length)
    return instances[index]
  }

  private geoProximity(
    instances: ServiceInstance[],
    clientRegion?: string,
  ): ServiceInstance {
    if (!clientRegion) return instances[0]

    // Find instance in same region or closest region
    const sameRegion = instances.find((i) => i.region === clientRegion)
    if (sameRegion) return sameRegion

    return instances[0]
  }

  updateInstances(instances: ServiceInstance[]): void {
    // Update weights based on instance health and performance
    for (const instance of instances) {
      let weight = 100 // Base weight

      if (instance.status !== 'healthy') {
        weight = 0
      } else {
        // Adjust weight based on metadata
        if (instance.metadata.weight) {
          weight = parseInt(instance.metadata.weight) || 100
        }
      }

      this.instanceWeights.set(instance.id, weight)
    }
  }
}

// Types
interface ServiceRegistration {
  name: string
  instanceId?: string
  region: string
  host: string
  port: number
  protocol?: string
  version?: string
  metadata?: Record<string, any>
  tags?: string[]
}

interface ServiceInstance {
  id: string
  name: string
  region: string
  host: string
  port: number
  protocol: string
  version: string
  metadata: Record<string, any>
  status: 'healthy' | 'unhealthy' | 'unknown'
  registeredAt: Date
  lastHeartbeat: Date
  tags: string[]
}

interface DiscoveryOptions {
  region?: string
  version?: string
  healthyOnly?: boolean
  tags?: string[]
  metadata?: Record<string, any>
  sortBy?: 'region' | 'version' | 'health' | 'registered'
  cacheTTL?: number
  watchInterval?: number
  clientRegion?: string
}

interface DiscoveryBackend {
  type: 'consul' | 'etcd' | 'zookeeper'
  client: any
  region: string
}

interface ServiceCacheEntry {
  instances: ServiceInstance[]
  timestamp: Date
  ttl: number
}

interface ServiceStats {
  totalServices: number
  totalInstances: number
  healthyInstances: number
  unhealthyInstances: number
  services: {
    [serviceName: string]: {
      totalInstances: number
      healthyInstances: number
      unhealthyInstances: number
      regions: string[]
    }
  }
}

interface LoadBalancerConfig {
  serviceName: string
  algorithm: string
  healthCheck?: any
  circuitBreaker?: any
}

export {
  ServiceRegistration,
  ServiceInstance,
  DiscoveryOptions,
  ServiceStats,
  LoadBalancerConfig,
}
