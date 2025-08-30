# Implementation Plan: pixel-innovations-audit (Version 3 - Comprehensive)

**Source Analysis:** `/home/vivi/pixelated/workspace/pixel-innovations-audit/01_analysis_v1.md`

## **Project Goal & Success Metrics**

-   **Goal:** To evolve the Pixel model from a collection of research scripts into a robust, flexible, and observable emotional intelligence engine. This involves productionizing mature ideas while rigorously and creatively vetting experimental concepts.
-   **Success Metrics:**
    -   [ ] **A Configurable Pipeline:** The production pipeline can be dynamically reconfigured (modules enabled/disabled) via a simple YAML file.
    -   [ ] **Data Integrity:** A strongly-typed data schema is enforced throughout the pipeline, preventing data-related runtime errors.
    -   [ ] **Complete Test Coverage:** The production pipeline has over 80% test coverage.
    -   [ ] **Clear Benchmarking:** The performance of the `EmotionalResNetMemory` module is quantitatively compared against a baseline, with results logged for review.
    -   [ ] **Actionable Research:** The research spike delivers clear, data-driven "Go/No-Go" recommendations for each of the three experimental modules.

---

## **Part 1: Core Pipeline Infrastructure (The "Venture" Upgrade)**

### Task 1: [ ] Install Enhanced Dependencies
-   **Objective:** Install dependencies for a more robust pipeline, including data validation (`pydantic`), configuration management (`pyyaml`), and visualization (`matplotlib`).
-   **Instructions:**
    -   Run the `uv pip install` command to add the new dependencies to the environment.
-   **Verification:**
    ```bash
    source .venv/bin/activate && uv pip install pydantic pyyaml matplotlib && uv pip freeze | grep -e pydantic -e pyyaml -e matplotlib
    ```

### Task 2: [ ] Implement Configuration-Driven Design
-   **Objective:** Create a YAML file to control the pipeline's behavior, making it flexible and easy to reconfigure without changing code.
-   **File(s) to Modify:**
    -   `config/emotional_pipeline.yaml` (new file)
-   **Instructions:**
    -   Create a new YAML file that defines a list of active modules (e.g., `cnn_encoder`, `resnet_memory`) and their execution order.
-   **Verification:**
    ```bash
    cat config/emotional_pipeline.yaml
    ```

### Task 3: [ ] Enforce Data Integrity with Schemas
-   **Objective:** Define `pydantic` models to act as data contracts between pipeline components, ensuring data is always valid and preventing common errors.
-   **File(s) to Modify:**
    -   `ai/pixel/pipeline/schemas.py` (new file)
-   **Instructions:**
    -   Create a new Python file and define `pydantic` models for `PipelineInput`, `EmotionFeatures`, `ContextualEmotions`, and `FullPipelineOutput` to create a strongly-typed data structure for each stage of the pipeline.
-   **Verification:**
    ```bash
    source .venv/bin/activate && python -c "from ai.pixel.pipeline.schemas import FullPipelineOutput; print('Schemas OK')"
    ```

### Task 4: [ ] Build the Dynamic Pipeline Engine
-   **Objective:** Create the main pipeline class that dynamically loads its configuration and modules at runtime.
-   **File(s) to Modify:**
    -   `ai/pixel/pipeline/emotional_pipeline.py` (new file)
-   **Instructions:**
    1.  Create the `EmotionalPipeline(nn.Module)` class.
    2.  The `__init__` method should read `config/emotional_pipeline.yaml`.
    3.  Based on the config, it should dynamically instantiate only the required modules.
    4.  The `forward` method should execute the modules in the configured order, validating the data against the `pydantic` schemas between each step.
-   **Verification:**
    ```bash
    source .venv/bin/activate && ruff check ai/pixel/pipeline/emotional_pipeline.py
    ```

---

## **Part 2: Productionizing & Observing**

### Task 5: [ ] Write Comprehensive, Config-Aware Tests
-   **Objective:** Create tests that not only validate the pipeline's logic but also its ability to be dynamically reconfigured.
-   **File(s) to Modify:**
    -   `tests/ai/pixel/pipeline/test_emotional_pipeline.py` (new file)
-   **Instructions:**
    1.  Add a test that runs the default pipeline with all modules enabled.
    2.  Add a second test that programmatically modifies the `config.yaml` to disable a module, re-initializes the pipeline, and asserts that the module was correctly skipped in the forward pass.
-   **Verification:**
    ```bash
    source .venv/bin/activate && pytest tests/ai/pixel/pipeline/test_emotional_pipeline.py
    ```

### Task 6: [ ] Implement Experiment Logging
-   **Objective:** Add a simple JSON logger to track pipeline runs and their results, which is crucial for benchmarking and debugging.
-   **File(s) to Modify:**
    -   `ai/pixel/pipeline/emotional_pipeline.py`
-   **Instructions:**
    -   In the `forward` method of the `EmotionalPipeline`, add logic to log the run's configuration, a summary of the input, and the final `FullPipelineOutput` schema to a structured log file at `logs/pipeline_runs.jsonl`.
-   **Verification:**
    ```bash
    # Verification will be running a test that executes the pipeline and then checking the log file.
    rm -f logs/pipeline_runs.jsonl && pytest tests/ai/pixel/pipeline/test_emotional_pipeline.py && cat logs/pipeline_runs.jsonl | wc -l
    ```

### Task 7: [ ] Visualize Emotional Dynamics
-   **Objective:** Create a script to visualize the complex output of the pipeline, making it easier to interpret.
-   **File(s) to Modify:**
    -   `scripts/visualization/visualize_pipeline_output.py` (new file)
-   **Instructions:**
    1.  The script should load a result from the `logs/pipeline_runs.jsonl` log.
    2.  It should generate and save two plots to an `output/` directory:
        -   A line chart of the emotional "velocity" and "acceleration" over time.
        -   A bar chart of the final "reflection_score" and "deviation" metrics.
-   **Verification:**
    ```bash
    source .venv/bin/activate && python scripts/visualization/visualize_pipeline_output.py && ls output/*.png
    ```

---

## **Part 3: The Research Spike (Actionable)**

### Task 8: [ ] Analyze `QuantumEmotionState`
-   **Objective:** Empirically compare the `QuantumEmotionState` module against a standard softmax probability distribution to evaluate its practical utility.
-   **File(s) to Modify:**
    -   `scripts/research/compare_quantum_vs_softmax.py` (new file)
    -   `.notes/pixel/research_spike/quantum_analysis.md` (new file)
-   **Instructions:**
    1.  Create the comparison script to run N simulations for both the quantum and softmax methods, printing a comparison of the resulting emotion distributions and the time taken.
    2.  Create the `quantum_analysis.md` file and document the results from the script, providing a qualitative analysis of the pros and cons.
-   **Verification:**
    ```bash
    source .venv/bin/activate && python scripts/research/compare_quantum_vs_softmax.py
    ```

### Task 9: [ ] Refactor and Test `NeuroplasticityLayer`
-   **Objective:** Improve the efficiency of the `NeuroplasticityLayer` and verify its basic stability.
-   **File(s) to Modify:**
    -   `ai/pixel/research/refactored_neuroplasticity_layer.py` (new file)
    -   `tests/ai/pixel/research/test_neuroplasticity_stability.py` (new file)
    -   `.notes/pixel/research_spike/neuroplasticity_analysis.md` (new file)
-   **Instructions:**
    1.  Create the refactored layer and replace the `for` loop with a vectorized implementation.
    2.  Create a `pytest` test that instantiates the refactored layer and asserts that its weights do not become `NaN` or `inf` after many iterations.
    3.  Document the refactoring and test results in `neuroplasticity_analysis.md`.
-   **Verification:**
    ```bash
    source .venv/bin/activate && pytest tests/ai/pixel/research/test_neuroplasticity_stability.py
    ```

### Task 10: [ ] Research `CausalEmotionGraph` Sourcing
-   **Objective:** Investigate and document established methods for learning a causal graph from data.
-   **File(s) to Modify:**
    -   `.notes/pixel/research_spike/causal_graph_analysis.md` (new file)
-   **Instructions:**
    1.  Use web search to find and review methods for causal discovery from data (e.g., PC algorithm, Granger causality).
    2.  In the markdown file, document at least two promising methods, discussing their pros and cons for use with conversational data.
-   **Verification:**
    ```bash
    # Manual verification by checking the content of the file.
    cat .notes/pixel/research_spike/causal_graph_analysis.md | wc -l
    ```
