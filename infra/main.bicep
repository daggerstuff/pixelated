param azureLocation string = resourceGroup().location
param environment string = 'production'
param environmentName string = 'production'
param containerRegistryName string = 'pixelatedbox'
param appServiceName string = 'pixelated'
param keyVaultName string = '${appServiceName}-kv'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: azureLocation
  sku: {
    name: 'Premium'  // Required for security features
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Disabled'
    policies: {
      quarantinePolicy: {
        status: 'enabled'
      }
      retentionPolicy: {
        status: 'enabled'
        days: 30
      }
      trustPolicy: {
        status: 'enabled'
        type: 'Notary'
      }
    }
  }
}

// App Service Plan (Linux) - Using Premium V3 tier for zone redundancy and better performance
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appServiceName}-plan'
  location: azureLocation
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    size: 'P1v3'
    capacity: 2
  }
  kind: 'linux'
  properties: {
    reserved: true
    zoneRedundant: true  // Enable zone redundancy for high availability
  }
}

// Key Vault (for secrets; RBAC must be granted separately)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: azureLocation
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}



resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: azureLocation
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientCertEnabled: true
    publicNetworkAccess: 'Disabled'
    siteConfig: {
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistryName}.azurecr.io'
        }
      ]
      linuxFxVersion: 'DOCKER|${containerRegistryName}.azurecr.io/pixelated:latest'
      alwaysOn: true
      healthCheckPath: '/api/health'
      ftpsState: 'Disabled'
      acrUseManagedIdentityCreds: true
      minimumElasticInstanceCount: 2  // Minimum instances for failover
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Role assignments for ACR access
resource appServiceAcrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(acr.id, appService.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output containerRegistryEndpoint string = acr.properties.loginServer
output appServiceDefaultHostName string = appService.properties.defaultHostName
output appServiceName string = appService.name
output containerRegistryName string = acr.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.properties.loginServer
output keyVaultName string = keyVault.name
