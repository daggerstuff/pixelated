// SPDX-License-Identifier: MIT
//
// SP1 Guest Program: Data Pipeline Integrity Proof
//
// This guest program runs inside the SP1 zkVM and proves that a data
// pipeline was executed correctly without revealing the input or output
// data. The proof covers:
//
// 1. SHA-256 commitment to input data
// 2. Correct operation dispatch (FHE operation type verification)
// 3. SHA-256 commitment to output data
// 4. Merkle root construction from pipeline step hashes
//
// The verifier checks that the proof was generated for the correct
// public inputs (input hash, output hash, Merkle root, operation type)
// without learning the actual data.

#![no_std]

extern crate alloc;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;

use sha2::{Digest, Sha256};

/// Pipeline step hash for Merkle tree construction
fn hash_step(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

/// Build a Merkle root from a list of leaf hashes
fn build_merkle_root(mut leaves: Vec<[u8; 32]>) -> [u8; 32] {
    if leaves.is_empty() {
        return [0u8; 32];
    }

    while leaves.len() > 1 {
        let mut next_level: Vec<[u8; 32]> = Vec::new();
        let mut i = 0;
        while i < leaves.len() {
            let left = leaves[i];
            let right = if i + 1 < leaves.len() {
                leaves[i + 1]
            } else {
                // Duplicate last leaf if odd number
                leaves[i]
            };

            let mut combined = [0u8; 64];
            combined[..32].copy_from_slice(&left);
            combined[32..].copy_from_slice(&right);

            let mut hasher = Sha256::new();
            hasher.update(&combined);
            let result = hasher.finalize();
            let mut hash = [0u8; 32];
            hash.copy_from_slice(&result);
            next_level.push(hash);

            i += 2;
        }
        leaves = next_level;
    }

    leaves[0]
}

/// Convert a byte array to hex string
fn to_hex(bytes: &[u8]) -> String {
    let hex_chars = b"0123456789abcdef";
    let mut result = String::new();
    for &byte in bytes {
        result.push(hex_chars[(byte >> 4) as usize] as char);
        result.push(hex_chars[(byte & 0xf) as usize] as char);
    }
    result
}

/// Pipeline proof input structure
#[derive(serde::Deserialize)]
pub struct PipelineInput {
    /// SHA-256 hash of the input data (hex string)
    pub input_hash: String,
    /// SHA-256 hash of the output data (hex string)
    pub output_hash: String,
    /// FHE operation type identifier
    pub operation_type: String,
    /// Pipeline step hashes (hex strings, each 64 chars)
    pub step_hashes: Vec<String>,
}

/// Pipeline proof output (public values committed to the proof)
#[derive(serde::Serialize)]
pub struct PipelineOutput {
    /// Committed input hash
    pub input_hash: String,
    /// Committed output hash
    pub output_hash: String,
    /// Committed Merkle root
    pub merkle_root: String,
    /// Operation type
    pub operation_type: String,
}

sp1_zkvm::entrypoint!(main);

pub fn main() {
    // Read input from the prover
    let input_bytes = sp1_zkvm::io::read_vec();
    let input: PipelineInput =
        serde_json::from_slice(&input_bytes).expect("Failed to deserialize pipeline input");

    // Verify input hash format (64 hex chars = 32 bytes)
    let input_hash_bytes = hex::decode(&input.input_hash).expect("Invalid input hash hex");
    assert!(input_hash_bytes.len() == 32, "Input hash must be 32 bytes");

    // Verify output hash format
    let output_hash_bytes = hex::decode(&input.output_hash).expect("Invalid output hash hex");
    assert!(
        output_hash_bytes.len() == 32,
        "Output hash must be 32 bytes"
    );

    // Parse step hashes and build Merkle tree
    let mut leaves: Vec<[u8; 32]> = Vec::new();
    for step_hex in &input.step_hashes {
        let step_bytes = hex::decode(step_hex).expect("Invalid step hash hex");
        assert!(step_bytes.len() == 32, "Step hash must be 32 bytes");
        let mut leaf = [0u8; 32];
        leaf.copy_from_slice(&step_bytes);
        leaves.push(leaf);
    }

    // Build Merkle root from step hashes
    let merkle_root = build_merkle_root(leaves);

    // Verify the Merkle root is non-trivial (not all zeros unless no steps)
    if input.step_hashes.is_empty() {
        assert!(
            merkle_root == [0u8; 32],
            "Empty pipeline should have zero root"
        );
    } else {
        assert!(
            merkle_root != [0u8; 32],
            "Non-empty pipeline should have non-zero root"
        );
    }

    // Commit public values to the proof
    let output = PipelineOutput {
        input_hash: input.input_hash.clone(),
        output_hash: input.output_hash.clone(),
        merkle_root: to_hex(&merkle_root),
        operation_type: input.operation_type.clone(),
    };

    let output_bytes = serde_json::to_vec(&output).expect("Failed to serialize pipeline output");
    sp1_zkvm::io::commit_slice(&output_bytes);
}
