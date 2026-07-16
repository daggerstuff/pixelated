// Side-effect module: seeds AI_SERVICE_API_KEY before the HuggingFace training
// backend is imported by training-orchestrator.test.ts, so its module-level
// `HF_API_KEY` const is captured as a non-empty value. Without this, the backend
// throws "AI_SERVICE_API_KEY is required" before it ever reaches the (intended)
// network call to the unreachable microservice.
process.env["AI_SERVICE_API_KEY"] = process.env["AI_SERVICE_API_KEY"] ?? "test-key";
