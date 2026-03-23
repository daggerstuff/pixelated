import logging
import subprocess
from pathlib import Path

import modal

logger = logging.getLogger(__name__)

# Define the Modal App
app = modal.App("pixelated-gguf-quantize")

# Define the image with llama-cpp dependencies
# We'll clone llama.cpp to get the conversion scripts
image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "build-essential", "cmake")
    .pip_install("numpy", "sentencepiece", "gguf", "transformers", "torch")
    .run_commands(
        "git clone https://github.com/ggerganov/llama.cpp.git /root/llama.cpp",
        "cd /root/llama.cpp && cmake -B build && cmake --build build --config Release",
    )
)

# Persistent volume where the merged model is stored
volume = modal.Volume.from_name("pixel-merged-models")


@app.function(
    image=image,
    cpu=8,  # Conversion/Quantization is CPU/RAM intensive
    memory=32768,  # 32GB RAM
    timeout=7200,  # 2 hours
    volumes={"/root/models": volume},
)
def quantize_task(model_dir: str, out_name: str, quantization_type: str = "Q4_K_M"):
    model_path = Path("/root/models") / model_dir
    gguf_unquantized = Path("/root/models") / f"{out_name}.fp16.gguf"
    gguf_final = Path("/root/models") / f"{out_name}.{quantization_type}.gguf"

    logger.info("🚀 Starting quantization for %s", model_dir)
    logger.info("Targeting: %s", gguf_final)

    # 1. Convert HF to GGUF (FP16/FP32 first)
    logger.info("📦 Step 1: Converting HF to GGUF (FP16)...")
    convert_cmd = [
        "python",
        "/root/llama.cpp/convert_hf_to_gguf.py",
        str(model_path),
        "--outfile",
        str(gguf_unquantized),
        "--outtype",
        "f16",
    ]

    result = subprocess.run(convert_cmd, capture_output=True, text=True, shell=False, check=False)
    if result.returncode != 0:
        logger.error("❌ Conversion failed:\n%s", result.stderr)
        return False
    logger.info("✅ Conversion to FP16 GGUF complete.")

    # 2. Quantize the GGUF file
    logger.info("💎 Step 2: Quantizing to %s...", quantization_type)
    quantize_bin = "/root/llama.cpp/build/bin/llama-quantize"
    quant_cmd = [quantize_bin, str(gguf_unquantized), str(gguf_final), quantization_type]

    result = subprocess.run(quant_cmd, capture_output=True, text=True, shell=False, check=False)
    if result.returncode != 0:
        logger.error("❌ Quantization failed:\n%s", result.stderr)
        return False

    logger.info("✅ Quantization complete: %s", gguf_final)

    # 3. Cleanup the intermediate FP16 GGUF to save space
    logger.info("🧹 Cleaning up intermediate files...")
    if gguf_unquantized.exists():
        gguf_unquantized.unlink()

    # Commit changes to Volume
    volume.commit()

    return str(gguf_final)


@app.local_entrypoint()
def main(model_dir: str = "merged-pixel-merged", out_name: str = "pixelated-v1-wayfarer"):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    logger.info("📡 Triggering remote quantization for %s...", model_dir)
    logger.info("This may take 10-20 minutes depending on CPU speed.")

    if final_path := quantize_task.remote(model_dir, out_name):
        logger.info("🎉 Success! Your quantized model is ready at: %s", final_path)
        logger.info("To download it for local use (e.g. Ollama/llama.cpp):")
        logger.info("modal volume get pixel-merged-models %s.Q4_K_M.gguf ./", out_name)
    else:
        logger.error("❌ Quantization failed. Check Modal logs.")
