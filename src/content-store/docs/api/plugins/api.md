---
title: "Plugin API Reference"
description: "Plugin API Reference documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "api"]
draft: false
toc: true
---

# Plugin API Reference

This document provides detailed information about the APIs available to plugin developers in the Pixelated
EHR Integration Platform.

## Core APIs

### Patient Management

#### `patients.search(criteria: SearchCriteria): Promise<Patient[]>`

Search for patients based on specified criteria.

**Parameters:**
```typescript
interface SearchCriteria {
  name?: string
  dateOfBirth?: Date
  mrn?: string
  status?: 'active' | 'inactive'
  limit?: number
  offset?: number
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
}
```

**Returns:** Promise resolving to an array of Patient objects.

**Example:**
```typescript
const patients = await api.patients.search({
  name: 'John',
  status: 'active',
  limit: 10,
  sort: {
    field: 'lastName',
    order: 'asc'
  }
})
```

#### `patients.get(id: string): Promise<Patient>`

Retrieve a specific patient by ID.

**Parameters:**
- `id`: The unique identifier of the patient

**Returns:** Promise resolving to a Patient object.

**Example:**
```typescript
const patient = await api.patients.get('123456')
```

#### `patients.update(id: string, data: Partial<Patient>): Promise<Patient>`

Update a patient's information.

**Parameters:**
- `id`: The unique identifier of the patient
- `data`: Partial Patient object containing fields to update

**Returns:** Promise resolving to the updated Patient object.

**Example:**
```typescript
const updatedPatient = await api.patients.update('123456', {
  phoneNumber: '+1-555-0123',
  email: 'john.doe@example.com'
})
```

### Appointment Management

#### `appointments.schedule(appointment: Appointment): Promise<Appointment>`

Schedule a new appointment.

**Parameters:**
```typescript
interface Appointment {
  patientId: string
  providerId: string
  startTime: Date
  endTime: Date
  type: string
  status: 'scheduled' | 'confirmed' | 'cancelled'
  notes?: string
  location?: {
    id: string
    name: string
  }
}
```

**Returns:** Promise resolving to the created Appointment object.

**Example:**
```typescript
const appointment = await api.appointments.schedule({
  patientId: process.env.PATIENT_ID || "example-patient-id",
  providerId: 'dr-smith',
  startTime: new Date('2024-04-01T09:00:00Z'),
  endTime: new Date('2024-04-01T10:00:00Z'),
  type: 'initial-consultation',
  status: 'scheduled',
  notes: 'First visit'
})
```

#### `appointments.cancel(id: string, reason: string): Promise<void>`

Cancel an existing appointment.

**Parameters:**
- `id`: The unique identifier of the appointment
- `reason`: The reason for cancellation

**Returns:** Promise resolving when the appointment is cancelled.

**Example:**
```typescript
await api.appointments.cancel('apt-123', 'Patient request')
```

#### `appointments.reschedule(id: string, newTime: Date): Promise<Appointment>`

Reschedule an existing appointment.

**Parameters:**
- `id`: The unique identifier of the appointment
- `newTime`: The new start time for the appointment

**Returns:** Promise resolving to the updated Appointment object.

**Example:**
```typescript
const rescheduled = await api.appointments.reschedule(
  'apt-123',
  new Date('2024-04-02T14:00:00Z')
)
```

### Utility APIs

#### Logger

The logger API provides structured logging capabilities with HIPAA compliance.

```typescript
interface Logger {
  info: (message: string, meta?: object) => void
  warn: (message: string, meta?: object) => void
  error: (message: string, error?: Error) => void
  debug: (message: string, meta?: object) => void
}
```

**Example:**
```typescript
api.logger.info('Processing patient data', {
  patientId: process.env.PATIENT_ID || "example-patient-id",
  action: 'update'
})

api.logger.error('Failed to schedule appointment', new Error('Conflict'))
```

#### Events

The events API allows plugins to subscribe to and emit events.

```typescript
interface Events {
  on: (event: string, handler: (data: unknown) => void) => void
  off: (event: string, handler: (data: unknown) => void) => void
  emit: (event: string, data: any) => void
  once: (event: string, handler: (data: unknown) => void) => void
}
```

**Example:**
```typescript
// Subscribe to events
api.events.on('appointment:created', (appointment) => {
  api.logger.info('New appointment created', { id: appointment.id })
})

// Emit events
api.events.emit('custom:event', {
  type: 'reminder',
  patientId: process.env.PATIENT_ID || "example-patient-id"
})
```

## Storage API

Plugins have access to a persistent key-value storage system.

### `storage.get(key: string): Promise<any>`

Retrieve a value from storage.

**Parameters:**
- `key`: The storage key

**Returns:** Promise resolving to the stored value.

**Example:**
```typescript
const settings = await api.storage.get('plugin-settings')
```

### `storage.set(key: string, value: any): Promise<void>`

Store a value in storage.

**Parameters:**
- `key`: The storage key
- `value`: The value to store

**Returns:** Promise resolving when the value is stored.

**Example:**
```typescript
await api.storage.set('plugin-settings', {
  notificationsEnabled: true,
  theme: 'dark'
})
```

## Configuration API

Access and modify plugin configuration.

### `config.get(): Promise<PluginConfig>`

Retrieve the plugin's configuration.

**Returns:** Promise resolving to the plugin's configuration object.

**Example:**
```typescript
const config = await api.config.get()
console.log(config.apiKey)
```

### `config.update(updates: Partial<PluginConfig>): Promise<PluginConfig>`

Update the plugin's configuration.

**Parameters:**
- `updates`: Partial configuration object with updates

**Returns:** Promise resolving to the updated configuration.

**Example:**
```typescript
const updatedConfig = await api.config.update({
  apiKey: process.env.API_KEY || "example-api-key",
  webhookUrl: 'https://example.com/webhook'
})
```

## Error Handling

All API methods may throw the following errors:

```typescript
class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: object
  ) {
    super(message)
  }
}

// Common error codes
type ErrorCode =
  | 'PERMISSION_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_ERROR'
```

**Example:**
```typescript
try {
  await api.patients.update('123456', {
    status: 'invalid-status'
  })
}
catch (error) {
  if (error.code === 'INVALID_ARGUMENT') {
    api.logger.error('Invalid patient status', error)
  }
}
```

## Rate Limits

Each API method has associated rate limits:

```typescript
const rateLimits = {
  'patients.search': 100, // requests per minute
  'patients.get': 300, // requests per minute
  'patients.update': 50, // requests per minute
  'appointments.schedule': 30, // requests per minute
  'appointments.cancel': 30, // requests per minute
  'appointments.reschedule': 30, // requests per minute
  'storage.get': 500, // requests per minute
  'storage.set': 100, // requests per minute
}
```

## Best Practices

1. **Error Handling**
   - Always wrap API calls in try-catch blocks
   - Log errors appropriately
   - Implement retry logic for transient failures
   - Provide meaningful error messages to users

2. **Performance**
   - Cache frequently accessed data
   - Batch operations when possible
   - Implement pagination for large result sets
   - Monitor rate limit usage

3. **Security**
   - Never store sensitive data in plugin storage
   - Validate all user input
   - Use minimum required permissions
   - Follow HIPAA compliance guidelines

## See Also

- [Plugin Lifecycle](lifecycle.md)
- [Security Guidelines](security.md)
- [Best Practices](best-practices.md)
- [Plugin Examples](../examples/plugins.md)
