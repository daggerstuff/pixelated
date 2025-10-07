---
title: "Secure Analytics Example"
description: "Secure Analytics Example documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Secure Analytics Example

This example demonstrates how to use MP-SPDZ TypeScript bindings to perform secure analytics on private data from multiple parties.

## Overview

The application performs the following analytics operations securely:

1. Mean calculation
2. Standard deviation
3. Correlation coefficient
4. Linear regression

## Installation

```bash
# Install dependencies
npm install @gradiant/mp-spdz-bindings

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install automake build-essential clang cmake git \
  libboost-dev libgmp-dev libntl-dev libsodium-dev libssl-dev \
  libtool python3 libstdc++-12-dev
```

## Usage

### 1. Initialize the Environment

```typescript
import { JIFFAdapter, JIFFAdapterConfig, MPCProtocol } from '@gradiant/mp-spdz-bindings'

const config: JIFFAdapterConfig = {
  partyId: 0, // Change for each party
  numParties: 3,
  threshold: 1,
  protocol: MPCProtocol.SEMI2K // Use SEMI2K for better performance
}

const adapter = new JIFFAdapter(config)
```

### 2. Secure Mean Calculation

```typescript
async function calculateSecureMean(values: number[]): Promise<number> {
  // Share all values
  const shares = await Promise.all(
    values.map(value => adapter.share(value))
  )

  // Sum the shares
  let sum = shares[0]
  for (let i = 1; i < shares.length; i++) {
    sum = await adapter.add(sum, shares[i])
  }

  // Create share for length
  const length = await adapter.share(BigInt(values.length))

  // Divide sum by length
  const mean = await adapter.multiply(sum, length)

  // Open the result
  return Number(await adapter.open(mean))
}

// Example usage
const values = [1, 2, 3, 4, 5]
const mean = await calculateSecureMean(values)
console.log('Secure mean:', mean)
```

### 3. Secure Standard Deviation

```typescript
async function calculateSecureStdDev(values: number[]): Promise<number> {
  // Calculate mean first
  const mean = await calculateSecureMean(values)
  const meanShare = await adapter.share(mean)

  // Share all values
  const shares = await Promise.all(
    values.map(value => adapter.share(value))
  )

  // Calculate squared differences
  const squaredDiffs = await Promise.all(
    shares.map(async (share) => {
      const diff = await adapter.subtract(share, meanShare)
      return adapter.multiply(diff, diff)
    })
  )

  // Sum squared differences
  let sum = squaredDiffs[0]
  for (let i = 1; i < squaredDiffs.length; i++) {
    sum = await adapter.add(sum, squaredDiffs[i])
  }

  // Divide by length
  const length = await adapter.share(BigInt(values.length))
  const variance = await adapter.multiply(sum, length)

  // Open the result and calculate square root
  const varianceValue = Number(await adapter.open(variance))
  return Math.sqrt(varianceValue)
}

// Example usage
const stdDev = await calculateSecureStdDev(values)
console.log('Secure standard deviation:', stdDev)
```

### 4. Secure Correlation Coefficient

```typescript
async function calculateSecureCorrelation(
  x: number[],
  y: number[]
): Promise<number> {
  if (x.length !== y.length) {
    throw new Error('Arrays must have same length')
  }

  // Share all values
  const xShares = await Promise.all(x.map(value => adapter.share(value)))
  const yShares = await Promise.all(y.map(value => adapter.share(value)))

  // Calculate means
  const xMean = await calculateSecureMean(x)
  const yMean = await calculateSecureMean(y)
  const xMeanShare = await adapter.share(xMean)
  const yMeanShare = await adapter.share(yMean)

  // Calculate covariance numerator
  const covProducts = await Promise.all(
    xShares.map(async (xShare, i) => {
      const xDiff = await adapter.subtract(xShare, xMeanShare)
      const yDiff = await adapter.subtract(yShares[i], yMeanShare)
      return adapter.multiply(xDiff, yDiff)
    })
  )

  // Sum products
  let covSum = covProducts[0]
  for (let i = 1; i < covProducts.length; i++) {
    covSum = await adapter.add(covSum, covProducts[i])
  }

  // Calculate standard deviations
  const xStdDev = await calculateSecureStdDev(x)
  const yStdDev = await calculateSecureStdDev(y)

  // Calculate correlation coefficient
  const denominator = await adapter.share(BigInt(xStdDev * yStdDev))
  const correlation = await adapter.multiply(covSum, denominator)

  // Open the result
  return Number(await adapter.open(correlation))
}

// Example usage
const x = [1, 2, 3, 4, 5]
const y = [2, 4, 6, 8, 10]
const correlation = await calculateSecureCorrelation(x, y)
console.log('Secure correlation:', correlation)
```

### 5. Secure Linear Regression

```typescript
async function calculateSecureLinearRegression(
  x: number[],
  y: number[]
): Promise<{ slope: number, intercept: number }> {
  if (x.length !== y.length) {
    throw new Error('Arrays must have same length')
  }

  // Share all values
  const xShares = await Promise.all(x.map(value => adapter.share(value)))
  const yShares = await Promise.all(y.map(value => adapter.share(value)))

  // Calculate means
  const xMean = await calculateSecureMean(x)
  const yMean = await calculateSecureMean(y)
  const xMeanShare = await adapter.share(xMean)
  const yMeanShare = await adapter.share(yMean)

  // Calculate slope numerator and denominator
  const numeratorProducts = await Promise.all(
    xShares.map(async (xShare, i) => {
      const xDiff = await adapter.subtract(xShare, xMeanShare)
      const yDiff = await adapter.subtract(yShares[i], yMeanShare)
      return adapter.multiply(xDiff, yDiff)
    })
  )

  const denominatorProducts = await Promise.all(
    xShares.map(async (xShare) => {
      const xDiff = await adapter.subtract(xShare, xMeanShare)
      return adapter.multiply(xDiff, xDiff)
    })
  )

  // Sum products
  let numeratorSum = numeratorProducts[0]
  let denominatorSum = denominatorProducts[0]
  for (let i = 1; i < numeratorProducts.length; i++) {
    numeratorSum = await adapter.add(numeratorSum, numeratorProducts[i])
    denominatorSum = await adapter.add(denominatorSum, denominatorProducts[i])
  }

  // Calculate slope
  const slope = await adapter.multiply(numeratorSum, denominatorSum)
  const slopeValue = Number(await adapter.open(slope))

  // Calculate intercept
  const interceptShare = await adapter.subtract(
    yMeanShare,
    await adapter.multiply(xMeanShare, await adapter.share(slopeValue))
  )
  const interceptValue = Number(await adapter.open(interceptShare))

  return { slope: slopeValue, intercept: interceptValue }
}

// Example usage
const regression = await calculateSecureLinearRegression(x, y)
console.log('Secure linear regression:', regression)
```

## Performance Considerations

1. **Batch Processing**
   - Process multiple values in parallel using `Promise.all`
   - Use preprocessing for better performance

2. **Protocol Selection**
   - Use Semi2k for better performance when security requirements allow
   - Use SPDZ2k for integer-heavy computations
   - Use MASCOT when malicious security is required

3. **Memory Management**
   - Clean up shares when no longer needed
   - Monitor memory usage during large computations

## Security Considerations

1. **Data Privacy**
   - All input data remains private
   - Only final results are revealed
   - Intermediate values remain secret

2. **Protocol Security**
   - Semi2k provides semi-honest security
   - Use MASCOT for malicious security if needed
   - Ensure proper network security (TLS)

3. **Error Handling**
   - Handle all errors appropriately
   - Log security-relevant events
   - Never expose sensitive data in errors

## Testing

```typescript
describe('Secure Analytics', () => {
  let adapter: JIFFAdapter

  beforeEach(() => {
    adapter = new JIFFAdapter({
      partyId: 0,
      numParties: 3,
      protocol: MPCProtocol.SEMI2K
    })
  })

  it('should calculate mean securely', async () => {
    const values = [1, 2, 3, 4, 5]
    const mean = await calculateSecureMean(values)
    expect(mean).toBe(3)
  })

  it('should calculate correlation securely', async () => {
    const x = [1, 2, 3, 4, 5]
    const y = [2, 4, 6, 8, 10]
    const correlation = await calculateSecureCorrelation(x, y)
    expect(correlation).toBeCloseTo(1.0)
  })
})
```

## Further Resources

- [Protocol Documentation](../../protocols/README.md)
- [JIFF Migration Guide](../../migration/jiff-to-mpspdz.md)
- [Security Analysis](../../protocols/security/)
- [Performance Benchmarks](../../protocols/benchmarks/)
