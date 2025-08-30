import uvicorn
from fastapi import FastAPI

from ai.pixel.pipeline.emotional_pipeline import EmotionalPipeline
from ai.pixel.pipeline.schemas import PipelineInput, FullPipelineOutput

app = FastAPI(
    title="Pixel Emotional Intelligence Engine",
    description="An API for analyzing the emotional content of text.",
    version="0.1.0",
)

pipeline = EmotionalPipeline()

@app.post("/analyze", response_model=FullPipelineOutput)
def analyze_text(input_data: PipelineInput):
    """
    Runs the emotional intelligence pipeline on the input text.
    """
    return pipeline.forward(input_data.text)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
