# Implementation Plan: pixel-innovations-audit (Version 2 - Research Spike)

**Source Analysis:** `/home/vivi/pixelated/workspace/pixel-innovations-audit/01_analysis_v1.md`

This plan details the tasks for the **Experimental Research Spike**. It is the second half of the recommended strategy.

## 1. Prerequisite Steps
- **Objective:** Create the directory structure to house all research findings.
- **Instructions:**
  - Create a new directory at `.notes/pixel/research_spike/`.
- **Verification:**
  ```bash
  ls -d .notes/pixel/research_spike/
  ```

## 2. Implementation Tasks

### Task 1: Analyze `QuantumEmotionState`
- **Objective:** Empirically compare the `QuantumEmotionState` module against a standard softmax probability distribution to evaluate its practical utility.
- **File(s) to Modify:**
  - `scripts/research/compare_quantum_vs_softmax.py` (new file)
  - `.notes/pixel/research_spike/quantum_analysis.md` (new file)
- **Instructions:**
  1. Create the comparison script. It should contain two main functions: one that simulates emotional state measurement using the `QuantumEmotionState` class, and another that does so using a standard `torch.multinomial` on a softmax distribution.
  2. The script should run N simulations for both methods, then print a comparison of the resulting emotion distributions and the average time taken for each method.
  3. Create the `quantum_analysis.md` file. Document the results from the script and provide a qualitative analysis of whether the quantum-inspired approach offers any tangible benefits over the standard probabilistic method.
- **Verification:**
  ```bash
  source .venv/bin/activate && python scripts/research/compare_quantum_vs_softmax.py
  ```

### Task 2: Refactor and Test `NeuroplasticityLayer`
- **Objective:** Improve the efficiency of the `NeuroplasticityLayer` and verify its basic stability.
- **File(s) to Modify:**
  - `ai/pixel/research/refactored_neuroplasticity_layer.py` (new file)
  - `tests/ai/pixel/research/test_neuroplasticity_stability.py` (new file)
  - `.notes/pixel/research_spike/neuroplasticity_analysis.md` (new file)
- **Instructions:**
  1. Create the `refactored_neuroplasticity_layer.py` file. Copy the original `NeuroplasticityLayer` into it.
  2. Modify the `forward` method in the refactored layer to replace the `for` loop over the batch with an efficient, vectorized implementation using PyTorch tensor operations (e.g., `torch.bmm` or `torch.einsum`).
  3. Create the `test_neuroplasticity_stability.py` test file. Add a `pytest` test that instantiates the *refactored* layer and repeatedly feeds it random data and reward signals, asserting that the layer's weights do not become `NaN` or `inf`.
  4. Create the `neuroplasticity_analysis.md` file. Document the refactoring and the results of the stability test.
- **Verification:**
  ```bash
  source .venv/bin/activate && pytest tests/ai/pixel/research/test_neuroplasticity_stability.py
  ```

### Task 3: Research `CausalEmotionGraph` Sourcing
- **Objective:** Investigate and document established methods for learning or defining a causal graph, which is a prerequisite for using the `CausalEmotionGraph` module.
- **File(s) to Modify:**
  - `.notes/pixel/research_spike/causal_graph_analysis.md` (new file)
- **Instructions:**
  1. Create the `causal_graph_analysis.md` file.
  2. Use the web search tool to find and review academic papers or technical articles on methods for causal discovery from data (e.g., PC algorithm, Granger causality, LiNGAM).
  3. For at least two promising methods, document a summary, their pros and cons for use with conversational emotional data, and links to the source material in the markdown file.
- **Verification:**
  ```bash
  # This is a research task. Verification is manual, by checking the content of the file.
  cat .notes/pixel/research_spike/causal_graph_analysis.md | wc -l
  ```

## 3. Final Verification
- **Objective:** Ensure all research spike scripts have been created and the analysis documents are populated.
- **Instructions:**
  - Confirm that all new scripts and markdown files from the tasks above have been created and are not empty.
- **Verification:**
  ```bash
  ls scripts/research/compare_quantum_vs_softmax.py && ls ai/pixel/research/refactored_neuroplasticity_layer.py && ls tests/ai/pixel/research/test_neuroplasticity_stability.py && [ $(cat .notes/pixel/research_spike/*.md | wc -l) -gt 5 ] && echo "Final verification passed."
  ```
