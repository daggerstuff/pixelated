# Implementation Plan: pixel-innovations-audit (Version 4 - Final)

**Source Analysis:** `/home/vivi/pixelated/workspace/pixel-innovations-audit/01_analysis_v1.md`

## **Project Goal & Success Metrics**

-   **Goal:** To evolve the Pixel model from a collection of research scripts into a robust, flexible, and observable emotional intelligence engine, and to define a clear strategy for how this engine will be utilized to create tangible value.
-   **Success Metrics:**
    -   [ ] **A Configurable Pipeline:** The production pipeline can be dynamically reconfigured via a simple YAML file.
    -   [ ] **A Deployable Service:** The final engine is exposed via a clean, stable API, ready for integration.
    -   [ ] **Complete Test Coverage:** The production pipeline has over 80% test coverage.
    -   [ ] **Actionable Research:** The research spike delivers clear, data-driven "Go/No-Go" recommendations for each experimental module.
    -   [ ] **A Recommended Utilization Strategy:** A final document is produced that recommends the best path forward for using the engine (e.g., as a plug-in, for RAG, etc.) based on prototype evidence.

---

## **Part 1: Core Pipeline Infrastructure**

### Task 1: [ ] Install Enhanced Dependencies
-   **Objective:** Install dependencies for a more robust pipeline, including data validation (`pydantic`), configuration (`pyyaml`), visualization (`matplotlib`), and serving (`fastapi`).
-   **Instructions:**
    -   Run the `uv pip install` command to add the new dependencies.
-   **Verification:**
    ```bash
    source .venv/bin/activate && uv pip install pydantic pyyaml matplotlib fastapi uvicorn && uv pip freeze | grep -e pydantic -e pyyaml -e matplotlib -e fastapi
    ```

### Task 2: [ ] Implement Configuration-Driven Design
-   **Objective:** Create a YAML file to control the pipeline's behavior.
-   **File(s) to Modify:** `config/emotional_pipeline.yaml` (new file)
-   **Instructions:** Create a YAML file that defines a list of active modules and their execution order.
-   **Verification:** `cat config/emotional_pipeline.yaml`

### Task 3: [ ] Enforce Data Integrity with Schemas
-   **Objective:** Define `pydantic` models to act as data contracts between pipeline components.
-   **File(s) to Modify:** `ai/pixel/pipeline/schemas.py` (new file)
-   **Instructions:** Create `pydantic` models for `PipelineInput`, `EmotionFeatures`, `ContextualEmotions`, and `FullPipelineOutput`.
-   **Verification:** `source .venv/bin/activate && python -c "from ai.pixel.pipeline.schemas import FullPipelineOutput; print('Schemas OK')"`

### Task 4: [ ] Build the Dynamic Pipeline Engine
-   **Objective:** Create the main pipeline class that dynamically loads its configuration and modules.
-   **File(s) to Modify:** `ai/pixel/pipeline/emotional_pipeline.py` (new file)
-   **Instructions:** Create the `EmotionalPipeline` class. It should read the YAML config to dynamically instantiate and run the configured modules, validating data with the `pydantic` schemas between steps.
-   **Verification:** `source .venv/bin/activate && ruff check ai/pixel/pipeline/emotional_pipeline.py`

---

## **Part 2: Productionizing & Observing**

### Task 5: [ ] Write Comprehensive, Config-Aware Tests
-   **Objective:** Create tests that validate the pipeline's logic and its ability to be reconfigured.
-   **File(s) to Modify:** `tests/ai/pixel/pipeline/test_emotional_pipeline.py` (new file)
-   **Instructions:** Add tests that run the default pipeline and also test that disabling a module in the config is respected.
-   **Verification:** `source .venv/bin/activate && pytest tests/ai/pixel/pipeline/test_emotional_pipeline.py`

### Task 6: [ ] Implement Experiment Logging
-   **Objective:** Add a JSON logger to track pipeline runs and their results.
-   **File(s) to Modify:** `ai/pixel/pipeline/emotional_pipeline.py`
-   **Instructions:** In the `forward` method, log the run's configuration and output to `logs/pipeline_runs.jsonl`.
-   **Verification:** `rm -f logs/pipeline_runs.jsonl && pytest tests/ai/pixel/pipeline/test_emotional_pipeline.py && cat logs/pipeline_runs.jsonl | wc -l`

### Task 7: [ ] Visualize Emotional Dynamics
-   **Objective:** Create a script to visualize the pipeline's output.
-   **File(s) to Modify:** `scripts/visualization/visualize_pipeline_output.py` (new file)
-   **Instructions:** The script should load a result from the log and generate plots for emotional velocity/acceleration and self-awareness metrics, saving them to the `output/` directory.
-   **Verification:** `source .venv/bin/activate && python scripts/visualization/visualize_pipeline_output.py && ls output/*.png`

---

## **Part 3: The Research Spike**

### Task 8: [ ] Analyze `QuantumEmotionState`
-   **Objective:** Empirically compare the `QuantumEmotionState` module against a standard softmax distribution.
-   **File(s) to Modify:** `scripts/research/compare_quantum_vs_softmax.py`, `.notes/pixel/research_spike/quantum_analysis.md` (new files)
-   **Instructions:** Create the comparison script to run simulations for both methods. Document the results and a qualitative analysis in the markdown file.
-   **Verification:** `source .venv/bin/activate && python scripts/research/compare_quantum_vs_softmax.py`

### Task 9: [ ] Refactor and Test `NeuroplasticityLayer`
-   **Objective:** Improve the efficiency of the `NeuroplasticityLayer` and verify its stability.
-   **File(s) to Modify:** `ai/pixel/research/refactored_neuroplasticity_layer.py`, `tests/ai/pixel/research/test_neuroplasticity_stability.py`, `.notes/pixel/research_spike/neuroplasticity_analysis.md` (new files)
-   **Instructions:** Refactor the layer to be vectorized. Create a `pytest` test to check for `NaN`/`inf` weights after many iterations. Document the results.
-   **Verification:** `source .venv/bin/activate && pytest tests/ai/pixel/research/test_neuroplasticity_stability.py`

### Task 10: [ ] Research `CausalEmotionGraph` Sourcing
-   **Objective:** Investigate and document methods for learning a causal graph from data.
-   **File(s) to Modify:** `.notes/pixel/research_spike/causal_graph_analysis.md` (new file)
-   **Instructions:** Use web search to find and document at least two methods for causal discovery, analyzing their pros and cons for conversational data.
-   **Verification:** `cat .notes/pixel/research_spike/causal_graph_analysis.md | wc -l`

---

## **Part 4: Utilization & End-Goal Strategy**

### Task 11: [ ] Expose the Engine via a Core API
-   **Objective:** Create a clean API endpoint for the emotional intelligence engine, making it a reusable, standalone service.
-   **File(s) to Modify:** `api/emotional_engine_api.py` (new file)
-   **Instructions:** Create a FastAPI server that wraps the `EmotionalPipeline`. It should expose a `/analyze` endpoint that accepts text and returns the `FullPipelineOutput` schema as JSON.
-   **Verification:** `source .venv/bin/activate && uvicorn api.emotional_engine_api:app & PID=$! && sleep 2 && curl -X POST -H "Content-Type: application/json" -d '{"text": "I am happy"}' http://127.0.0.1:8000/analyze && kill $PID`

### Task 12: [ ] Prototype a "Plug-in" Architecture
-   **Objective:** Design and demonstrate a system where the emotional analysis can augment the prompt for a primary LLM.
-   **File(s) to Modify:** `examples/plugin_architecture_demo.py` (new file)
-   **Instructions:** Create a script that 1) gets emotional analysis from the new API, 2) combines the analysis with the original prompt into an "augmented prompt," and 3) prints the result.
-   **Verification:** `source .venv/bin/activate && python examples/plugin_architecture_demo.py`

### Task 13: [ ] Prototype a RAG-style "Emotional Memory"
-   **Objective:** Explore using the pipeline's output to create a simple Retrieval-Augmented Generation system for emotional context.
-   **File(s) to Modify:** `examples/rag_emotional_memory_demo.py` (new file)
-   **Instructions:** Create a script that 1) gets the emotional analysis for a new prompt, 2) performs a simple search over the `logs/pipeline_runs.jsonl` file to find past interactions with a similar emotional profile, and 3) prints the retrieved context.
-   **Verification:** `source .venv/bin/activate && python examples/rag_emotional_memory_demo.py`

### Task 14: [ ] Document the Final Utilization Strategy
-   **Objective:** Create a final document that summarizes the pros and cons of each utilization strategy and makes a recommendation for the best path forward.
-   **File(s) to Modify:** `.notes/pixel/utilization_strategy.md` (new file)
-   **Instructions:** Based on the prototypes, write a document comparing the "Plug-in" vs. "RAG" vs. "Standalone Service" models. Analyze them on complexity, flexibility, and potential impact, and recommend a primary strategy for the project's end goal.
-   **Verification:** `cat .notes/pixel/utilization_strategy.md | wc -l`
