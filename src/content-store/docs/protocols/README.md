---
title: "MP-SPDZ Protocol Documentation"
description: "MP-SPDZ Protocol Documentation documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# MP-SPDZ Protocol Documentation

This document provides detailed information about the secure multi-party computation (MPC) protocols available in our TypeScript bindings for MP-SPDZ.

## Available Protocols

We support three main protocols, each with different security guarantees and performance characteristics:

1. [MASCOT](./mascot.md) - Maximum security with malicious adversaries
2. [SPDZ2k](./spdz2k.md) - Optimized for integer arithmetic
3. [Semi2k](./semi2k.md) - Best performance in semi-honest settings

## Protocol Selection Guide

Choose the appropriate protocol based on your security and performance requirements:

### MASCOT Protocol

- **Security Level**: Highest (malicious security)
- **Use Case**: When security is the top priority
- **Performance**: Moderate
- **Features**:
  - Malicious security with up to n-1 corrupted parties
  - Full MAC-based verification
  - Secure against active adversaries
  - Supports all arithmetic operations

### SPDZ2k Protocol

- **Security Level**: High (malicious security)
- **Use Case**: Integer arithmetic applications
- **Performance**: Good
- **Features**:
  - Optimized for k-bit integer operations
  - MAC-based verification
  - Efficient preprocessing phase
  - Native support for integer comparison

### Semi2k Protocol

- **Security Level**: Moderate (semi-honest security)
- **Use Case**: When performance is critical
- **Performance**: Excellent
- **Features**:
  - Semi-honest security model
  - No MAC computation overhead
  - Fastest execution time
  - Simplified preprocessing phase

## Performance Comparison

| Protocol | Security Model | Preprocessing | Online Phase | Memory Usage |
|----------|---------------|---------------|--------------|--------------|
| MASCOT   | Malicious     | Slow          | Moderate     | High         |
| SPDZ2k   | Malicious     | Moderate      | Fast         | Moderate     |
| Semi2k   | Semi-honest   | Fast          | Very Fast    | Low          |

## Security Considerations

### Trust Assumptions

- **MASCOT**: Requires honest majority, secure against active adversaries
- **SPDZ2k**: Requires honest majority, secure against active adversaries
- **Semi2k**: Assumes all parties follow the protocol honestly

### Network Requirements

- All protocols require reliable, low-latency network connections
- TLS 1.3 is used for secure channel communication
- Proper key management and session handling is essential

### Data Privacy

- All protocols guarantee input privacy
- Output privacy depends on the application logic
- Side-channel protections vary by protocol

## Implementation Details

### Common Components

- All protocols use the same network layer
- Share format is consistent across protocols
- Error handling follows the same patterns
- Preprocessing data management is protocol-specific

### Protocol-Specific Features

- **MASCOT**:
  - Full MAC verification
  - Triple generation with active security
  - Zero-knowledge proofs for verification
- **SPDZ2k**:
  - k-bit integer arithmetic
  - Optimized comparison operations
  - Efficient MAC generation
- **Semi2k**:
  - Simplified share operations
  - No MAC computation
  - Direct arithmetic operations

## Best Practices

1. **Protocol Selection**
   - Choose based on security requirements first
   - Consider performance only after security needs are met
   - Test with realistic data volumes

2. **Network Configuration**
   - Use secure channels (TLS 1.3)
   - Configure proper timeouts
   - Handle network failures gracefully

3. **Error Handling**
   - Implement proper error recovery
   - Log security-relevant events
   - Monitor protocol execution

4. **Performance Optimization**
   - Use appropriate batch sizes
   - Optimize preprocessing phase
   - Monitor resource usage

## Further Reading

- [Protocol Specifications](./specs/)
- [Security Analysis](./security/)
- [Performance Benchmarks](./benchmarks/)
- [Network Requirements](./network/)
- [Error Handling](./errors/)
