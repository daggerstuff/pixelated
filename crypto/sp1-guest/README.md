# SP1 Guest Program: Data Pipeline Integrity Proof

This directory contains the SP1 zkVM guest program that proves data pipeline
integrity for the Pixelated Empathy FHE layer.

## Overview

The guest program runs inside the SP1 zero-knowledge virtual machine and proves
that:

1. A SHA-256 commitment to input data was correctly computed
2. A SHA-256 commitment to output data was correctly computed
3. The Merkle root of pipeline step hashes was correctly constructed
4. The operation type is committed to the proof

The verifier learns only the public commitments (input hash, output hash, Merkle
root, operation type) — not the actual input/output data.

## Building

```bash
# Install SP1 toolchain (requires network access)
curl -L https://sp1.succinct.tools | bash
sp1up

# Build the guest program
cd sp1-guest
cargo prove build

# The ELF binary will be at: elf/riscv32im-succinct-zkvm-elf
```

## Proving

```bash
# Generate a proof
cargo prove run

# The proof and public values are written to the prover output
```

## Integration

The TypeScript `SP1Prover` class in `src/lib/fhe/sp1-prover.ts` provides:

- `prove(inputHash, outputHash, operationType, stepHashes)` → SP1 proof
- `verify(proof, publicInputs)` → boolean
- Automatic fallback to hash-commitment mode when SP1 isn't available

## Architecture

```
Client (Therapist App)
  │
  ├── Encrypts data with SEAL (BFV scheme)
  │
  ▼
FHE Server (Pixelated Empathy)
  │
  ├── HomomorphicOperations.processEncrypted()
  │     ├── EncryptedTextProcessor (fully homomorphic)
  │     └── Produces encrypted output
  │
  ▼
SP1 Prover
  │
  ├── Hashes input/output (SHA-256)
  ├── Builds Merkle root from step hashes
  ├── Runs guest program in zkVM
  │
  ▼
ZK Proof Artifact
  │
  ▼
Verifier (POST /api/v1/zk/verify)
  │
  ├── Checks proof validity
  ├── Matches public commitments
  └── Returns valid/invalid
```

## Dependencies

- `sp1-zkvm` v4.1: SP1 zkVM entrypoint and I/O
- `sha2` v0.10: SHA-256 hashing
- `hex` v0.4: Hex encoding/decoding
- `serde` v1.0: Serialization
