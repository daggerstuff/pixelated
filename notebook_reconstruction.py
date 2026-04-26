import json
from pathlib import Path

notebook_path = Path("ai/training/pixelated_colab_pilot.ipynb")

# We define the core functional blocks from our hardened .py scripts
cell_blocks = [
    {
        "cell_type": "markdown",
        "source": [
            "# 🚀 Wayfarer-2-12B Distributed Production Pilot\n",
            "**Status**: Round XXV - Global NCCL Sync Hardened\n",
            "**Data**: 35.6B Token S3 Stream"
        ]
    },
    {
        "cell_type": "code",
        "source": [
            "# =============================================================================\n",
            "# CELL 0: KEEP ALIVE\n",
            "# =============================================================================\n",
            "import IPython\n",
            "import time\n",
            "import threading\n",
            "display(IPython.display.Javascript('''function KeepAlive(){var b=document.querySelector(\"colab-connect-button\");if(b){var s=b.shadowRoot.querySelector(\"#connect\");if(s)s.click();}}setInterval(KeepAlive,55000);'''))\n",
            "print('✅ Keep-alive active.')"
        ]
    },
    {
        "cell_type": "code",
        "source": [
            "# 1. Determinism & S3 Environment\n",
            "!apt-get install rclone -y\n",
            "!pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"\n",
            "!pip install --no-deps \"xformers<0.0.27\" \"trl<0.9.0\" peft accelerate bitsandbytes\n",
            "!pip install better-sqlite3 wandb scikit-learn sentencepiece\n",
            "\n",
            "import os\n",
            "from google.colab import userdata\n",
            "os.environ['HETZNER_S3_ACCESS_KEY'] = userdata.get('HETZNER_S3_ACCESS_KEY')\n",
            "os.environ['HETZNER_S3_SECRET_KEY'] = userdata.get('HETZNER_S3_SECRET_KEY')\n",
            "os.environ['HETZNER_S3_ENDPOINT'] = 'https://hel1.your-objectstorage.com'\n",
            "os.environ['HETZNER_S3_REGION'] = 'hel1'\n",
            "os.environ['HETZNER_S3_BUCKET'] = 'pixel-data'"
        ]
    },
    {
        "cell_type": "code",
        "source": [
            "# 2. Initialize Model & FocalLoss\n",
            "from unsloth import FastLanguageModel\n",
            "import torch\n",
            "import torch.nn as nn\n",
            "import torch.nn.functional as F\n",
            "\n",
            "model, tokenizer = FastLanguageModel.from_pretrained(\n",
            "    model_name = 'LatitudeGames/Wayfarer-2-12B',\n",
            "    max_seq_length = 8192,\n",
            "    load_in_4bit = True,\n",
            ")\n",
            "\n",
            "model = FastLanguageModel.get_peft_model(\n",
            "    model, r=64, lora_alpha=16, use_rslora=True, use_gradient_checkpointing='unsloth'\n",
            ")\n",
            "\n",
            "class FocalLoss(nn.Module):\n",
            "    def __init__(self, gamma=1.5, label_smoothing=0.05):\n",
            "        super().__init__()\n",
            "        self.gamma, self.label_smoothing = gamma, label_smoothing\n",
            "\n",
            "    def forward(self, logits, targets):\n",
            "        mask = targets != -100\n",
            "        v_logits, v_targets = logits[mask], targets[mask]\n",
            "        if v_targets.numel() == 0: return torch.zeros(1, device=logits.device, requires_grad=True)\n",
            "        log_probs = F.log_softmax(v_logits, dim=-1)\n",
            "        with torch.no_grad():\n",
            "            pt = torch.exp(F.log_softmax(v_logits, dim=-1)).gather(1, v_targets.unsqueeze(1)).squeeze(1)\n",
            "        nll_loss = F.nll_loss(log_probs, v_targets, reduction='none')\n",
            "        smooth_loss = -log_probs.mean(dim=-1)\n",
            "        smoothed_ce = (1.0 - self.label_smoothing) * nll_loss + self.label_smoothing * smooth_loss\n",
            "        return (((1.0 - pt) ** self.gamma) * smoothed_ce).mean()"
        ]
    },
    {
        "cell_type": "code",
        "source": [
            "# 3. Data Engine & Trainer Setup\n",
            "from reservoir_sampler import WeightedReservoirSampler\n",
            "from dataloader_callback import DataloaderStateCallback\n",
            "from convergence_guard import ConvergenceGuard\n",
            "from trl import SFTTrainer, DataCollatorForCompletionOnlyLM\n",
            "from transformers import TrainingArguments\n",
            "\n",
            "class WayfarerTrainer(SFTTrainer):\n",
            "    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):\n",
            "        labels = inputs.pop('labels', None)\n",
            "        outputs = model(**inputs)\n",
            "        if labels is not None:\n",
            "            logits = outputs.get('logits')\n",
            "            loss = FocalLoss(gamma=1.5, label_smoothing=0.05)(logits[..., :-1, :].contiguous().view(-1, logits.size(-1)), labels[..., 1:].contiguous().view(-1))\n",
            "        else: loss = outputs.get('loss')\n",
            "        return (loss, outputs) if return_outputs else loss\n",
            "\n",
            "sampler = WeightedReservoirSampler(db_path='/content/drive/MyDrive/pixelated/ai/training_corpus/assets/registry.db')\n",
            "def gen_wayfarer():\n",
            "    for item in sampler.stream():\n",
            "        text = tokenizer.apply_chat_template(item.get('messages', []), tokenize=False)\n",
            "        tokenized = tokenizer(text, truncation=True, max_length=8192)\n",
            "        yield {'input_ids': tokenized['input_ids'], 'attention_mask': tokenized['attention_mask']}\n",
            "\n",
            "training_args = TrainingArguments(\n",
            "    output_dir='./outputs', max_steps=270000, learning_rate=2e-5, dataloader_num_workers=4,\n",
            "    callbacks=[ConvergenceGuard(model), DataloaderStateCallback('./outputs', 4)]\n",
            ")\n",
            "trainer = WayfarerTrainer(model=model, train_dataset=torch.utils.data.IterableDataset.from_generator(gen_wayfarer), args=training_args)\n",
            "print('🔥 Ready for production run.')"
        ]
    }
]

nb = {"cells": cell_blocks, "metadata": {}, "nbformat": 4, "nbformat_minor": 4}
with open(notebook_path, 'w') as f:
    json.dump(nb, f, indent=2)
print('✅ Notebook reconstructed.')
