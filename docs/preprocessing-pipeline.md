# Multimodal Preprocessing Pipeline

## Overview

The preprocessing pipeline is a crucial component of the multimodal bias detection system. It handles the preparation and transformation of raw audio, vision, and video data into formats suitable for machine learning models.

## Pipeline Components

### Audio Preprocessing Pipeline

Handles audio data preprocessing including:

- **Audio Loading**: Supports various audio formats (MP3, WAV, FLAC, etc.)
- **Normalization**: Peak normalization to [-1, 1] range
- **Feature Extraction**: Extracts acoustic features like MFCC, tempo, spectral centroid
- **Model Preparation**: Prepares inputs for Whisper and Wav2Vec2 models

#### Key Features

```python
# Initialize pipeline
audio_pipeline = AudioPreprocessingPipeline()

# Preprocess audio data
result = await audio_pipeline.preprocess_audio(audio_bytes)
```

### Vision Preprocessing Pipeline

Handles image data preprocessing including:

- **Image Loading**: Supports various image formats (JPEG, PNG, GIF, etc.)
- **Resizing**: Maintains aspect ratio while constraining dimensions
- **Color Space Conversion**: Ensures RGB format
- **Model Preparation**: Prepares inputs for Vision Transformer models

#### Key Features

```python
# Initialize pipeline
vision_pipeline = VisionPreprocessingPipeline()

# Preprocess image data
result = await vision_pipeline.preprocess_image(image_bytes)
```

### Video Preprocessing Pipeline

Handles video data preprocessing including:

- **Video Loading**: Supports various video formats (MP4, AVI, MOV, etc.)
- **Frame Extraction**: Extracts key frames at configurable rates
- **Frame Processing**: Converts frames to RGB format
- **Model Preparation**: Prepares inputs for VideoMAE models

#### Key Features

```python
# Initialize pipeline
video_pipeline = VideoPreprocessingPipeline()

# Preprocess video data
result = await video_pipeline.preprocess_video(video_bytes)
```

### Multimodal Preprocessing Pipeline

Unified pipeline that orchestrates preprocessing across all modalities:

```python
# Initialize multimodal pipeline
multimodal_pipeline = MultimodalPreprocessingPipeline()

# Preprocess multiple data types
data = {
    "audio": audio_bytes,
    "image": image_bytes,
    "video": video_bytes
}
result = await multimodal_pipeline.preprocess_multimodal_data(data)
```

## Configuration

The pipeline uses settings defined in `config.py`:

- **Max File Sizes**: Limits for audio, image, and video files
- **Sample Rates**: Standardized audio sample rates
- **Dimensions**: Maximum image and video dimensions
- **Formats**: Allowed file formats for each modality

## Performance Metrics

The pipeline includes built-in performance monitoring:

```python
from preprocessing_pipeline import PreprocessingMetrics

metrics = PreprocessingMetrics()
metrics.record_timing("audio_preprocessing", 0.5)
average_time = metrics.get_average_time("audio_preprocessing")
```

## Error Handling

The pipeline implements comprehensive error handling:

- **Format Validation**: Validates input file formats
- **Size Limits**: Enforces maximum file size constraints
- **Duration Limits**: Enforces maximum audio/video duration constraints
- **Graceful Degradation**: Continues processing when non-critical steps fail

## Testing

The pipeline includes comprehensive unit tests in `tests/unit/ai/test_preprocessing_pipeline.py` covering:

- Individual pipeline components
- Data validation functions
- Error handling scenarios
- Integration tests

## Usage Examples

### Basic Audio Preprocessing

```python
import asyncio
from preprocessing_pipeline import AudioPreprocessingPipeline

async def process_audio():
    pipeline = AudioPreprocessingPipeline()

    # Load audio data (from file, API, etc.)
    with open("audio_sample.wav", "rb") as f:
        audio_bytes = f.read()

    # Preprocess audio
    result = await pipeline.preprocess_audio(audio_bytes)

    print(f"Processed audio with duration: {result['duration']} seconds")
    print(f"Extracted features: {list(result['features'].keys())}")

# Run the example
asyncio.run(process_audio())
```

### Multimodal Processing

```python
import asyncio
from preprocessing_pipeline import MultimodalPreprocessingPipeline

async def process_multimodal_data():
    pipeline = MultimodalPreprocessingPipeline()

    # Prepare multimodal data
    data = {
        "audio": audio_bytes,  # from previous example
        "image": image_bytes,  # loaded from image file
    }

    # Process all modalities
    result = await pipeline.preprocess_multimodal_data(data)

    print(f"Processed modalities: {result['metadata']['modalities_processed']}")

    # Access individual results
    if "audio" in result["results"]:
        audio_result = result["results"]["audio"]
        print(f"Audio duration: {audio_result['duration']} seconds")

# Run the example
asyncio.run(process_multimodal_data())
```

## Extending the Pipeline

To extend the pipeline with new preprocessing steps:

1. **Add new methods** to existing pipeline classes
2. **Update configuration** in `config.py` if needed
3. **Add validation** functions for new data types
4. **Include tests** in the test suite
5. **Update documentation** with new features

## Performance Considerations

- **Batch Processing**: Process multiple files in batches when possible
- **Memory Management**: Clean up temporary files immediately after use
- **GPU Acceleration**: Leverage GPU when available for model preparation
- **Caching**: Cache processor loading to avoid repeated initialization