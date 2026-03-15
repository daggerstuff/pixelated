import os
import modal

# Define the Modal App
app = modal.App("pixelated-gguf-quantize")

# Define the image with llama-cpp dependencies
# We'll clone llama.cpp to get the conversion scripts
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "build-essential", "cmake")
    .pip_install(
        "numpy",
        "sentencepiece",
        "gguf",
        "transformers",
        "torch"
    )
    .run_commands(
        "git clone https://github.com/ggerganov/llama.cpp.git /root/llama.cpp",
        "cd /root/llama.cpp && cmake -B build && cmake --build build --config Release"
    )
)

# Persistent volume where the merged model is stored
volume = modal.Volume.from_name("pixel-merged-models")

@app.function(
    image=image,
    cpu=8,                # Conversion/Quantization is CPU/RAM intensive
    memory=32768,         # 32GB RAM
    timeout=7200,         # 2 hours
    volumes={"/root/models": volume}
)
def quantize_task(model_dir: str, out_name: str, quantization_type: str = "Q4_K_M"):
    import subprocess
    from pathlib import Path

    model_path = Path("/root/models") / model_dir
    gguf_unquantized = Path("/root/models") / f"{out_name}.fp16.gguf"
    gguf_final = Path("/root/models") / f"{out_name}.{quantization_type}.gguf"

    print(f"🚀 Starting quantization for {model_dir}")
    print(f"Targeting: {gguf_final}")

    # 1. Convert HF to GGUF (FP16/FP32 first)
    print("📦 Step 1: Converting HF to GGUF (FP16)...")
    convert_cmd = [
        "python", "/root/llama.cpp/convert_hf_to_gguf.py",
        str(model_path),
        "--outfile", str(gguf_unquantized),
        "--outtype", "f16"
    ]

    result = subprocess.run(convert_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Conversion failed:\n{result.stderr}")
        return False
    print("✅ Conversion to FP16 GGUF complete.")

    # 2. Quantize the GGUF file
    print(f"💎 Step 2: Quantizing to {quantization_type}...")
    quantize_bin = "/root/llama.cpp/build/bin/llama-quantize"
    quant_cmd = [
        quantize_bin,
        str(gguf_unquantized),
        str(gguf_final),
        quantization_type
    ]

    result = subprocess.run(quant_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Quantization failed:\n{result.stderr}")
        return False

    print(f"✅ Quantization complete: {gguf_final}")

    # 3. Cleanup the intermediate FP16 GGUF to save space
    print("🧹 Cleaning up intermediate files...")
    if gguf_unquantized.exists():
        gguf_unquantized.unlink()

    # Commit changes to Volume
    volume.commit()

    return str(gguf_final)

@app.local_entrypoint()
def main(model_dir: str = "merged-pixel-merged", out_name: str = "pixelated-v1-wayfarer"):
    print(f"📡 Triggering remote quantization for {model_dir}...")
    print("This may take 10-20 minutes depending on CPU speed.")

    if final_path := quantize_task.remote(model_dir, out_name):
        print(f"\n🎉 Success! Your quantized model is ready at: {final_path}")
        print("To download it for local use (e.g. Ollama/llama.cpp):")
        print(f"modal volume get pixel-merged-models {out_name}.Q4_K_M.gguf ./")
    else:
        print("\n❌ Quantization failed. Check Modal logs.")
