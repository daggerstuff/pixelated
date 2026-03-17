# Kaggle QLoRA Training Instructions

## Free GPU Training Option

Kaggle offers **30 free GPU hours/week** with T4 (16GB VRAM). This is enough for QLoRA training of a 12B model.

---

## Step 1: Prepare Training Data

1. Go to [kaggle.com](https://kaggle.com) and sign in
2. Go to **Datasets** → **New Dataset**
3. Upload training data:
   - `/home/vivi/pixelated/ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl`
4. Title: `pixelated-training-data`
5. Make it Private
6. Note the dataset ID: `your-username/pixelated-training-data`

---

## Step 2: Create Notebook

1. Go to **Notebooks** → **New Notebook**
2. Select **GPU T4 x2** accelerator (Settings → Accelerator)
3. Attach your dataset:
   - Right sidebar → **+ Add Data**
   - Search for `pixelated-training-data`
   - Click **Add**

---

## Step 3: Upload Training Script

Copy `scripts/training/train_kaggle_qlora.py` content into the notebook:

```python
# Cell 1: Install dependencies
!pip install -q transformers peft bitsandbytes accelerate datasets

# Cell 2: Paste the entire train_kaggle_qlora.py script
# ... paste script here ...

# Cell 3: Update data path and run
CONFIG["data_path"] = "/kaggle/input/pixelated-training-data"
main()
```

---

## Step 4: Run Training

1. Click **Run All**
2. Training will take ~2-4 hours for 3 epochs
3. Monitor progress in output

---

## Step 5: Download Adapter

After training completes:

```python
# Cell to download adapter
import shutil
shutil.make_archive('pixelated-v2-adapter', 'zip', './checkpoints/pixelated-v2-qlora')

from IPython.display import FileLink
FileLink('pixelated-v2-adapter.zip')
```

Click the link to download the adapter.

---

## Step 6: Merge and Evaluate

Back on local machine:

```bash
# Copy adapter to local
# Then merge:
python scripts/training/merge_lora.py \
  --base_model LatitudeGames/Wayfarer-2-12B \
  --adapter ./pixelated-v2-qlora \
  --output ./merged-pixelated-v2

# Run evaluation
modal run ai/modal_app.py
```

---

## Time Estimates

| Stage               | Time (T4)  |
| ------------------- | ---------- |
| Setup               | ~10 min    |
| Training (3 epochs) | ~2-4 hours |
| Save/Download       | ~5 min     |

**Total: ~3-5 hours** (well within 12-hour session limit)

---

## Troubleshooting

### OOM Error
- Reduce `per_device_train_batch_size` to 1
- Increase `gradient_accumulation_steps` to 32
- Reduce `max_seq_length` to 1024

### Slow Training
- Normal for QLoRA on T4
- Expect ~1-2 samples/min
- 500 samples × 3 epochs = ~2.5 hours

### Disconnected Session
- Kaggle has 12-hour session limit
- Use `save_steps=250` to checkpoint frequently
- Resume by reloading last checkpoint
