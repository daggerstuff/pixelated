param resourceGroupName string
param azureLocation string = resourceGroup().location
param environment string = 'production'
param containerRegistryName string = 'pixelatedcr'
param containerAppName string = 'pixelated-web'
param appServiceName string = 'pixelated'
param customDomain string = ''

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: containerRegistryName
  location: azureLocation
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: true
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'pixel-env-${environment}'
  location: azureLocation
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: ''
        sharedKey: ''
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: azureLocation
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 4321
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          password: acr.listCredentials().passwords[0].value
        }
      ]
      secrets: []
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: '${acr.properties.loginServer}/${containerAppName}:latest'
          resources: {
            cpu: '0.5'
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'PORT'
              value: '4321'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: azureLocation
  kind: 'app'
  properties: {
    serverFarmId: ''
    siteConfig: {
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment
        }
        {
          name: 'PORT'
          value: '4321'
        }
        {
          name: 'WEBSITES_PORT'
          value: '4321'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
      ]
      containerSettings: {
        imageName: '${acr.properties.loginServer}/${containerAppName}:latest'
        registryUrl: 'https://${acr.properties.loginServer}'
        registryUsername: acr.listCredentials().username
        registryPassword: acr.listCredentials().passwords[0].value
      }
    }
  }
}

output containerRegistryEndpoint string = acr.properties.loginServer
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output appServiceDefaultHostName string = appService.properties.defaultHostName