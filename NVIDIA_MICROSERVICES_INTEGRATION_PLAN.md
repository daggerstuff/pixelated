# NVIDIA Microservices Integration Plan (Phase 1)

This plan outlines the integration of the "Priority 1" NVIDIA microservices to enhance the Pixelated Empathy AI pipeline.

## 1. NeMo Curator (#1) - Data Quality & Filtering

**Goal:** Replace heuristic cleaning scripts with high-performance neural quality filtering for Stage 1 & 2.
**Implementation:**

- Create `docker-compose.nemo-curator.yml`.
- Add a processing service that mounts the `ai/datasets/` directory.
- Use NeMo Curator container for fuzzy deduplication and toxicity/empathy quality filtering.

## 3. NeMo Retriever (#3) - RAG Optimization

**Goal:** Upgrade the "Psychology Knowledge Base" with state-of-the-art embedding and reranking models.
**Implementation:**

- Create `docker-compose.nemo-retriever.yml`.
- Deploy **NVIDIA NIM for Retrieval** (Embedding model: `nv-embedqa-e5-v5`).
- Integrate with existing Qdrant/Milvus vector stores.

## 5. NeMo Customizer (#5) - Accelerated Fine-Tuning

**Goal:** Transition training scripts into a microservice-orchestrated LoRA/SFT pipeline on H100s.
**Implementation:**

- Create `docker-compose.nemo-customizer.yml`.
- Set up the Customizer microservice + PostgreSQL/Datastore backend.
- Map `ai/training_data_consolidated/final/` as the input path.

## 6. NeMo Evaluator (#6) - RAG & Reasoning Validation

**Goal:** Automate "LLM-as-a-judge" evaluations for Dual Persona and Reasoning stages.
**Implementation:**

- Create `docker-compose.nemo-evaluator.yml`.
- Configure automated evaluation flows for RAG accuracy and persona consistency.

---

## Deployment Order

1. **Infrastructure Shared Services** (Postgres, Datastore, NMP Core)
2. **Customizer & Evaluator** (Training & Testing loop)
3. **Retriever** (Knowledge Base upgrade)
4. **Curator** (Pre-training data refinement)
