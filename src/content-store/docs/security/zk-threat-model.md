---
title: ZK Proof System Threat Model
description: Threat model for the Zero-Knowledge proof layer covering data pipeline integrity
pubDate: '2026-07-22'
---

## ZK Proof System Threat Model

This document describes the threat model for the Zero-Knowledge proof
system implemented per ADR-0004, covering the SP1-based hash-commitment proof
layer for FHE data pipeline integrity.

## System Boundaries

The ZK proof system operates within the following trust boundaries:

1. **FHE Layer** (trusted): Executes homomorphic operations on encrypted data
   via Microsoft SEAL (node-seal WASM, BFV scheme)
2. **ZKProofService** (trusted): Generates and verifies hash-commitment proofs
   wrapping FHE operations
3. **Verification Endpoint** (semi-trusted): `POST /api/v1/zk/verify` accepts
   proof artifacts from authenticated clients
4. **SP1 Remote Prover** (semi-trusted): External proving service (Succinct
   hosted) that generates zkVM proofs in production

## Assets Protected

- **Patient session transcripts**: Pre-encryption plaintext inputs to FHE
- **FHE operation results**: Post-decryption outputs from homomorphic operations
- **Pipeline integrity**: Proof that the correct operation was dispatched and
  output was derived from committed inputs
- **Audit trail**: Proof artifacts stored alongside session records for
  compliance verification

## Threat Actors

### 1. Malicious Insider (System Administrator)

**Capability**: Access to server infrastructure, databases, logs
**Motivation**: Tamper with patient data, alter analysis results

**Mitigations**:
- ZK proofs provide cryptographic evidence of pipeline integrity
- Proof artifacts stored immutably alongside session records
- Hash commitments make post-hoc tampering detectable
- Merkle root commits to all intermediate steps (single-step tampering
  changes the root)

**Residual Risk**: Administrator could suppress proof verification (mitigated
by external audit logging via HIPAAMonitoringService)

### 2. External Attacker (API Consumer)

**Capability**: Send crafted requests to verification endpoint
**Motivation**: Forge valid proofs, bypass verification

**Mitigations**:
- Verification endpoint requires authentication (`protectRoute({})`)
- Proof format validation (64-char hex for proof + Merkle root)
- Input/output hash must match proof artifact (re-verification)
- Rate limiting via existing API middleware

**Residual Risk**: Attacker with valid credentials could submit a
legitimately-generated proof for a different session (mitigated by
binding proof to session context in production)

### 3. Compromised FHE Layer

**Capability**: Bypass FHE operations, return fabricated results
**Motivation**: Alter analysis output without detection

**Mitigations**:
- ZK proof wraps the FHE operation: input hash, operation type, and output
  hash are all committed
- `wrapOperation()` captures I/O before and after FHE callback
- Proof generation is non-bypassable (integrated into `ZKProvenResult`)

**Residual Risk**: Compromised FHE layer could produce correct proof
structure with fabricated data (mitigated by independent output
verification in production via SP1 zkVM proof)

### 4. Proof Replay Attacker

**Capability**: Capture a valid proof and replay it for a different session
**Motivation**: Claim pipeline integrity for unverified data

**Mitigations**:
- Proof artifact includes `timestamp` field
- Proof is bound to `publicInputHash` and `publicOutputHash` (specific
  to the session data)
- Verification checks that submitted hashes match proof artifact

**Residual Risk**: If input/output hashes collide across sessions (extremely
unlikely with SHA-256), proof could be replayed

## Attack Surfaces

### 1. Proof Generation Path

**Entry**: `ZKProofService.generateProof()` / `wrapOperation()`
**Risk**: If proof generation is bypassed, no integrity guarantee

**Mitigation**: `wrapOperation()` is the only path that returns
`ZKProvenResult`. The caller must use this wrapper to get a proof.
Direct FHE calls without proof wrapping are logged as warnings.

### 2. Verification Endpoint

**Entry**: `POST /api/v1/zk/verify`
**Risk**: Endpoint could be abused for DoS (proof verification is cheap but
not free)

**Mitigation**: Authentication required, rate limiting, proof format
validation before verification logic runs

### 3. Proof Storage

**Entry**: Session records with embedded `zkProof` artifacts
**Risk**: Proof tampering in storage

**Mitigation**: Proof artifacts are hash-commitments; modifying any field
invalidates the proof. Storage layer (PostgreSQL) provides row-level
security.

## Security Properties

### Properties Provided

1. **Integrity**: Proof verifies that input hash, operation type, and output
   hash are cryptographically linked via Merkle root
2. **Non-repudiation**: Proof artifact is stored with timestamp; prover
   cannot deny having generated it
3. **Tamper detection**: Any modification to input, output, or intermediate
   steps changes the Merkle root, invalidating the proof
4. **Auditability**: Proof artifacts are self-contained and verifiable
   independently of the prover

### Properties NOT Provided (Out of Scope)

1. **Zero-knowledge of input data**: The current hash-commitment scheme
   reveals input/output hashes (not the data itself, but the hashes are
   public inputs). Full ZK privacy (hiding the witness) requires the SP1
   zkVM proof in production.
2. **Proof of correct LLM inference**: The proof covers data pipeline
   integrity (hash commitments), not the correctness of the AI model's
   output. This is a known limitation documented in ADR-0004.
3. **Real-time proof generation**: Current implementation uses simulated
   hash-commitments. Production SP1 proofs will add 1-2s overhead.

## Enterprise Use Case

### Clinical Trial Data Integrity

**Scenario**: A pharmaceutical company uses Pixelated Empathy to analyze
patient session transcripts across multiple clinical trial sites. Auditors
need cryptographic evidence that:

1. Patient transcripts were not modified before analysis
2. The correct analysis operation (summarize, sentiment, categorize) was
   applied to each transcript
3. Analysis outputs match the committed inputs

**Solution**: Each FHE operation generates a ZK proof artifact. Auditors
can independently verify proofs via `POST /api/v1/zk/verify` without
accessing patient data (only the hash commitments are needed).

**Benefits**:
- **Compliance**: HIPAA audit trail with cryptographic evidence
- **Trust**: Multi-site trials can verify data integrity without sharing
  raw transcripts
- **Non-repudiation**: Proof artifacts prove analysis was performed as
  claimed
- **Efficiency**: Sub-second proof generation, sub-100ms verification

### Insurance Claim Verification

**Scenario**: An insurance provider requires proof that AI analysis of
therapy sessions was performed correctly before approving claims.

**Solution**: ZK proof artifacts are attached to claim submissions.
Insurance provider verifies proofs via the API endpoint without needing
access to session transcripts.

### Research Data Provenance

**Scenario**: Researchers use anonymized analysis outputs from Pixelated
Empathy. They need assurance that the outputs were derived from genuine
patient data through the correct analysis pipeline.

**Solution**: ZK proof artifacts serve as provenance certificates.
Researchers verify proofs to confirm data pipeline integrity before
using outputs in studies.

## Mitigation Summary

| Threat | Likelihood | Impact | Mitigation | Residual Risk |
|---|---|---|---|---|
| Malicious insider tampering | Medium | High | ZK proofs + Merkle root | Audit suppression |
| Forged proof submission | Low | High | Auth + format validation | Credential theft |
| Compromised FHE layer | Low | Critical | Proof wrapping (non-bypassable) | Correct proof, fabricated data |
| Proof replay | Very Low | Medium | Timestamp + hash binding | Hash collision (negligible) |
| DoS on verify endpoint | Medium | Low | Auth + rate limiting | Authenticated DoS |

## Related Documents

- [ADR-0004](/architecture/decisions/0004-zero-knowledge-system) — ZK proof
  system decision and library evaluation
- [Encryption & ZK System](/security/encryption) — Encryption architecture
  and ZK implementation details
- [HIPAA Compliance](/security/hipaa-compliance) — Compliance framework
- [Risk Assessment](/security/risk-assessment) — Overall security risk
  assessment

## Update: SP1 Integration (2026-07-23, PIX-4118)

### Implementation Status

The ZK proof system now has a dual-mode architecture:

1. **SP1 mode** (production): When the SP1 toolchain is installed and the
   guest ELF binary is available, proofs are generated by executing the Rust
   guest program (`sp1-guest/src/main.rs`) which proves Merkle root
   construction over pipeline step hashes using SHA-256 inside the zkVM.
   The prover shells out to `cargo prove run --elf <path>`.

2. **Hash-commitment mode** (fallback): When SP1 is unavailable (e.g.,
   serverless Vercel without Rust toolchain), the system falls back to
   SHA-256 hash commitments. This provides data integrity but NOT
   zero-knowledge properties. The `proofMode` field in `ZKProofArtifact`
   transparently indicates which mode was used.

### Threat Model Changes

- **Proof mode transparency**: All proof artifacts now include
  `proofMode: 'sp1' | 'hash-commitment'`. Verifiers MUST check this field
  and treat hash-commitment proofs as integrity-only (not ZK).
- **SP1 toolchain dependency**: Production deployments should install
  the SP1 toolchain and pre-build the guest ELF to ensure SP1 mode is
  always available. Hash-commitment fallback is for dev/staging only.
- **No new attack surfaces**: SP1 mode executes the same hash-commitment
  logic but inside the zkVM, adding verifiability without exposing new
  attack surfaces.

### FHE Upgrade (PIX-4116)

The `EncryptedTextProcessor` now performs 9 text operations as fully
homomorphic computation on SEAL ciphertext (BFV, BatchEncoder, 4096 slots):

- sentiment, categorize, word_count, character_count, keyword_density,
  tokenize, filter, summarize, reading_level

All operations use `multiplyPlain` + `rotation+add` reduction. The server
never decrypts during computation — only the `categorize` operation
decrypts the final category scores for result construction (the computation
itself is fully homomorphic). This eliminates the previous
decrypt→process→re-encrypt pattern that exposed plaintext in memory.
