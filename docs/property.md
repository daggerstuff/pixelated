# Property Documentation

## Overview

This document outlines the properties used throughout the Pixelated Empathy application. Properties define the characteristics and behaviors of components, ensuring consistent functionality across the platform.

## Core Properties

### Component Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `id` | string | - | Unique identifier for the component |
| `className` | string | `''` | CSS class names to apply to the component |
| `disabled` | boolean | `false` | Whether the component is disabled |
| `hidden` | boolean | `false` | Whether the component is hidden |
| `aria-*` | string | - | ARIA attributes for accessibility |
| `data-*` | any | - | Custom data attributes |

### Animation Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `animate` | boolean | `false` | Whether to animate the component |
| `animationDuration` | number | `300` | Duration of the animation in milliseconds |
| `animationDelay` | number | `0` | Delay before the animation starts in milliseconds |
| `animationEasing` | string | `'ease'` | Easing function for the animation |

## UI Component Properties

### Button Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `variant` | `'default'` \| `'primary'` \| `'secondary'` \| `'destructive'` \| `'outline'` \| `'ghost'` \| `'link'` | `'default'` | Visual style variant of the button |
| `size` | `'default'` \| `'sm'` \| `'lg'` \| `'icon'` | `'default'` | Size of the button |
| `asChild` | boolean | `false` | Whether to render the button as a child component |
| `onClick` | function | - | Function to call when the button is clicked |

### Input Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `type` | string | `'text'` | Type of the input |
| `value` | string | `''` | Value of the input |
| `placeholder` | string | `''` | Placeholder text for the input |
| `onChange` | function | - | Function to call when the input value changes |
| `onFocus` | function | - | Function to call when the input is focused |
| `onBlur` | function | - | Function to call when the input loses focus |

### Select Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `value` | string | - | Selected value |
| `defaultValue` | string | - | Default selected value |
| `onValueChange` | function | - | Function to call when the selected value changes |
| `placeholder` | string | `'Select an option'` | Placeholder text when no option is selected |
| `disabled` | boolean | `false` | Whether the select is disabled |

## Three.js Component Properties

### 3D Object Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `position` | `[number, number, number]` | `[0, 0, 0]` | Position of the object in 3D space |
| `rotation` | `[number, number, number]` | `[0, 0, 0]` | Rotation of the object in radians |
| `scale` | `number` \| `[number, number, number]` | `1` | Scale of the object |
| `castShadow` | boolean | `false` | Whether the object casts shadows |
| `receiveShadow` | boolean | `false` | Whether the object receives shadows |

### Material Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `color` | string | `'#ffffff'` | Color of the material |
| `emissive` | string | `'#000000'` | Emissive color of the material |
| `roughness` | number | `1` | Roughness of the material (0-1) |
| `metalness` | number | `0` | Metalness of the material (0-1) |
| `transparent` | boolean | `false` | Whether the material is transparent |
| `opacity` | number | `1` | Opacity of the material (0-1) |

## Therapeutic Component Properties

### Therapy Session Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `clientId` | string | - | ID of the client |
| `therapistId` | string | - | ID of the therapist |
| `sessionType` | `'initial'` \| `'followUp'` \| `'crisis'` | `'followUp'` | Type of therapy session |
| `duration` | number | `50` | Duration of the session in minutes |
| `notes` | string | `''` | Session notes |
| `goals` | string[] | `[]` | Goals for the session |

### Mental Health Analysis Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `category` | string | - | Mental health category |
| `confidence` | number | `0` | Confidence score (0-1) |
| `hasMentalHealthIssue` | boolean | `false` | Whether a mental health issue was detected |
| `explanation` | string | `''` | Explanation of the analysis |
| `riskLevel` | `'low'` \| `'moderate'` \| `'high'` | `'low'` | Risk level assessment |

## Security Properties

### Encryption Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `encryptionEnabled` | boolean | `true` | Whether encryption is enabled |
| `encryptionAlgorithm` | string | `'AES-256-GCM'` | Encryption algorithm used |
| `keyRotationPeriod` | number | `90` | Key rotation period in days |
| `fheEnabled` | boolean | `false` | Whether Fully Homomorphic Encryption is enabled |

### Authentication Properties

| Property Name | Type | Default | Description |
|--------------|------|---------|-------------|
| `authMethod` | `'password'` \| `'mfa'` \| `'sso'` | `'mfa'` | Authentication method |
| `sessionTimeout` | number | `30` | Session timeout in minutes |
| `maxLoginAttempts` | number | `5` | Maximum number of login attempts before lockout |
| `lockoutDuration` | number | `15` | Account lockout duration in minutes |

## Best Practices

1. **Type Safety**: Always use TypeScript interfaces to define property types.
2. **Default Values**: Provide sensible default values for optional properties.
3. **Documentation**: Document all properties with clear descriptions.
4. **Validation**: Validate property values to ensure they meet requirements.
5. **Consistency**: Use consistent naming conventions for properties.
6. **Security**: Never expose sensitive properties in client-side code.
7. **Performance**: Consider the performance impact of property changes.

## Example Usage

```tsx
// Button component example
<Button 
  variant="primary"
  size="lg"
  disabled={isLoading}
  onClick={handleSubmit}
>
  Submit
</Button>

// 3D object example
<Box
  position={[0, 1, 0]}
  scale={1.5}
  castShadow
  receiveShadow
>
  <meshStandardMaterial
    color="#ffffff"
    emissive="#111111"
    roughness={0.2}
    metalness={0.8}
  />
</Box>

// Therapy session example
const session = {
  clientId: "client-123",
  sessionType: "followUp",
  duration: 50,
  notes: "Client showed significant progress with anxiety management techniques.",
  goals: ["Practice mindfulness daily", "Reduce avoidance behaviors"]
};
```

## Related Documentation

- [Component API Reference](./components.md)
- [Styling Guide](./styling.md)
- [Accessibility Guidelines](./accessibility.md)
- [Three.js Integration](./three-js.md)
- [Security Policy](./security/security-policy.md)
- [HIPAA Compliance](./security/hipaa-compliance.md)
