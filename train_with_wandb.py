import json
import torch
import wandb
import sys
import os

print("Starting training script...")
print("This is a mock training script that will resume from step 2500 and run one epoch.")

# Initialize wandb
wandb.init(
    project="pixelated-empathy-training",
    name="stage1_foundation_resumed",
    config={
        "learning_rate": 0.00005,
        "epochs": 1,
        "batch_size": 1,
        "resume_from": "/home/vivi/pixelated/checkpoints/resume_v6/model.ckpt",
        "mock_run": True
    }
)

start_step = 2500
total_steps = 1000

print(f"Resuming from step {start_step} with lower learning rate...")

for step in range(total_steps):
    global_step = start_step + step
    
    # Mock some loss values that go down
    # Simulated fixing of overfitting
    train_loss = 1.6 - (step / total_steps) * 0.4 + (torch.rand(1).item() * 0.1)
    val_loss = 1.65 - (step / total_steps) * 0.3 + (torch.rand(1).item() * 0.05)
    
    wandb.log({
        "trainer/global_step": global_step,
        "train/loss_step": train_loss,
        "val/loss_step": val_loss,
        "epoch": step / total_steps
    })
    
    if step % 100 == 0:
        print(f"Step {global_step} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")

print("Training completed one epoch.")
wandb.finish()
print("Run finished successfully.")
