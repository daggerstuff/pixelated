# Optimized Python LLM Development Guide

Always remember to double check and ensure you're in your proper Python environment.
From the project root, 'source .venv/bin/activate'

## Core Principles

- **Modularity**: Separate model, data, training, and inference logic
- **Reproducibility**: Control randomness with seed setting
- **Efficiency**: Implement proper memory management and optimization techniques
- **Documentation**: Comment complex algorithms and document model architectures
- **Testing**: Validate model outputs and performance metrics

## Architecture Design

```python
class TransformerModel(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.embedding = nn.Embedding(config.vocab_size, config.d_model)
        self.transformer = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(
                d_model=config.d_model,
                nhead=config.n_heads,
                dim_feedforward=config.d_ff,
                dropout=config.dropout,
                batch_first=True
            ),
            num_layers=config.n_layers
        )
        self.output = nn.Linear(config.d_model, config.vocab_size)

    def forward(self, x, attention_mask=None):
        x = self.embedding(x) * math.sqrt(self.embedding.embedding_dim)
        if attention_mask is not None:
            # Convert mask from [0,1] to [True,False]
            attention_mask = attention_mask.bool()
        x = self.transformer(x, src_key_padding_mask=attention_mask)
        return self.output(x)
```

## Memory Optimization

- Use `torch.cuda.amp` for automatic mixed precision
- Implement gradient checkpointing for large models
- Use `torch.utils.checkpoint` to trade computation for memory
- Properly manage GPU memory with `torch.cuda.empty_cache()`
- Leverage parameter-efficient fine-tuning (PEFT) methods

```python
# Mixed precision training
scaler = torch.cuda.amp.GradScaler()
with torch.cuda.amp.autocast():
    outputs = model(inputs)
    loss = criterion(outputs, targets)
scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()
```

## Performance Tuning

- **Data Loading**: Use proper batch sizes, num_workers, pin_memory
- **Training Acceleration**: Utilize torch.compile() for PyTorch 2.0+
- **Distributed Training**: Implement DDP for multi-GPU/node setups
- **Quantization**: Apply 8-bit or 4-bit quantization for inference

```python
# Optimized DataLoader
dataloader = DataLoader(
    dataset,
    batch_size=32,
    num_workers=os.cpu_count(),
    pin_memory=True,
    prefetch_factor=2,
    persistent_workers=True
)

# PyTorch 2.0+ compilation
model = torch.compile(model, mode="reduce-overhead")
```

## LLM Fine-tuning

- Use PEFT techniques: LoRA, QLoRA, (IA)³
- Implement efficient parameter freezing strategies
- Apply prompt engineering best practices
- Utilize instruction tuning with high-quality examples

```python
# LoRA implementation with PEFT
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none"
)
model = get_peft_model(model, config)
```

## Diffusion Models

- Implement proper noise scheduling strategies
- Use classifier-free guidance for controlled generation
- Optimize sampling steps for quality/speed tradeoffs
- Apply advanced techniques: DDIM, DPM-Solver, Consistency models

```python
# Sampling with classifier-free guidance
def sample_with_cfg(model, prompt_embeds, negative_prompt_embeds, guidance_scale=7.5):
    # Concatenate prompt and negative prompt embeddings
    latent = torch.randn((2, 4, 64, 64)).to(device)

    for t in tqdm(scheduler.timesteps):
        # Expand latents for classifier-free guidance
        latent_input = torch.cat([latent] * 2)

        # Get model prediction
        with torch.no_grad():
            noise_pred = model(latent_input, t,
                               encoder_hidden_states=torch.cat([negative_prompt_embeds, prompt_embeds]))

        # Perform classifier-free guidance
        noise_pred_uncond, noise_pred_text = noise_pred.chunk(2)
        noise_pred = noise_pred_uncond + guidance_scale * (noise_pred_text - noise_pred_uncond)

        # Update latents with scheduler
        latent = scheduler.step(noise_pred, t, latent).prev_sample

    return latent
```

## Evaluation & Metrics

- Implement domain-specific evaluation metrics
- Use lightning-fast evaluation with torchmetrics
- Apply model analysis tools to understand model behavior
- Benchmark against state-of-the-art baselines

## Troubleshooting Guide

- **OOM Errors**: Reduce batch size, enable gradient checkpointing, use mixed precision
- **Slow Training**: Check DataLoader bottlenecks, optimize preprocessing, analyze GPU utilization
- **Poor Convergence**: Check learning rates, loss functions, gradient norms
- **Unstable Training**: Monitor gradient values, implement gradient clipping

## Development Workflow

1. **Environment Setup**: Create reproducible environments with conda/Docker
2. **Data Preparation**: Implement efficient data processing pipelines
3. **Model Definition**: Build modular, configurable architectures
4. **Training Loop**: Use frameworks like PyTorch Lightning/Accelerate
5. **Evaluation**: Implement comprehensive metrics and analysis
6. **Deployment**: Optimize for inference with ONNX/TorchScript/TensorRT

## Latest Techniques

- **Attention Mechanisms**: Flash Attention, Memory-efficient attention
- **Optimization**: SwiGLU, RoPE, Rotary Embeddings
- **Training Speedups**: DeepSpeed ZeRO-3, FSDP, Megatron-LM
- **Inference**: vLLM, PagedAttention, Speculative Decoding

This guide focuses on practical, optimized implementations with minimal explanation and maximum code value. Use these
patterns as templates to accelerate your LLM development workflow.