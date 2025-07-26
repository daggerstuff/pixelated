// User-assigned managed identity for container app
param environmentName string
param location string

resource userIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'pixel-${uniqueString(subscription().id, resourceGroup().id, environmentName)}'
  location: location
}

output resourceId string = userIdentity.id
output principalId string = userIdentity.properties.principalId
