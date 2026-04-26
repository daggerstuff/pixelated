import json
from pathlib import Path

notebook_path = Path("ai/training/pixelated_colab_pilot.ipynb")
with open(notebook_path, "r") as f:
    nb = json.load(f)

for cell in nb["cells"]:
    if cell["cell_type"] == "code":
        source = "".join(cell["source"])
        
        # 1. Sync FocalLoss
        if "class FocalLoss" in source:
            cell["source"] = [
                "class FocalLoss(nn.Module):\n",
                "    def __init__(self, gamma=1.5, label_smoothing=0.05):\n",
                "        super().__init__()\n",
                "        self.gamma = gamma\n",
                "        self.label_smoothing = label_smoothing\n",
                "\n",
                "    def forward(self, logits, targets):\n",
                "        mask = targets != -100\n",
                "        v_logits = logits[mask]\n",
                "        v_targets = targets[mask]\n",
                "        if v_targets.numel() == 0:\n",
                "            return (logits * 0.0).sum()\n",
                "        log_probs = F.log_softmax(v_logits, dim=-1)\n",
                "        nll_loss = F.nll_loss(log_probs, v_targets, reduction='none')\n",
                "        pt = torch.exp(-nll_loss)\n",
                "        smooth_loss = -log_probs.mean(dim=-1)\n",
                "        smoothed_ce = (1.0 - self.label_smoothing) * nll_loss + self.label_smoothing * smooth_loss\n",
                "        return (((1.0 - pt) ** self.gamma) * smoothed_ce).mean()\n"
            ]

        # 2. Sync compute_loss
        if "def compute_loss" in source and "class WayfarerTrainer" in source:
            cell["source"] = [
                "class WayfarerTrainer(SFTTrainer):\n",
                "    def __init__(self, *args, sampler=None, focal_gamma=1.5, **kwargs):\n",
                "        super().__init__(*args, **kwargs)\n",
                "        self.sampler = sampler\n",
                "        self.focal_loss_fn = FocalLoss(gamma=focal_gamma, label_smoothing=getattr(self.args, 'label_smoothing_factor', 0.05))\n",
                "\n",
                "    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):\n",
                "        labels = inputs.get(\"labels\")\n",
                "        model_inputs = {k: v for k, v in inputs.items() if k != \"labels\"}\n",
                "        outputs = model(**model_inputs)\n",
                "        logits = outputs.get(\"logits\")\n",
                "        \n",
                "        if labels is not None and logits is not None:\n",
                "            shift_logits = logits[..., :-1, :].contiguous()\n",
                "            shift_labels = labels[..., 1:].contiguous()\n",
                "            loss = self.focal_loss_fn(shift_logits.view(-1, shift_logits.size(-1)), shift_labels.view(-1))\n",
                "        else:\n",
                "            loss = outputs.get(\"loss\", torch.tensor(0.0, device=model.device))\n",
                "            \n",
                "        return (loss, outputs) if return_outputs else loss\n"
            ]
            
        # 3. WayfarerDataset
        if "class WayfarerDataset(" in source:
            cell["source"] = [
                "class WayfarerDataset(torch.utils.data.IterableDataset):\n",
                "    def __init__(self, sampler, tokenizer):\n",
                "        self.sampler = sampler\n",
                "        self.tokenizer = tokenizer\n",
                "    def __iter__(self):\n",
                "        for item in self.sampler.stream():\n",
                "            messages = item.get(\"messages\", [])\n",
                "            text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)\n",
                "            tokenized = self.tokenizer(text, truncation=True, max_length=8192)\n",
                "            yield {\"input_ids\": tokenized[\"input_ids\"], \"attention_mask\": tokenized[\"attention_mask\"]}\n",
                "\n",
                "train_dataset = WayfarerDataset(sampler, tokenizer)\n"
            ]

        # 4. Remove old IPC/Sync variables from Trainer args
        if "trainer.train(" in source:
            new_source = []
            for line in cell["source"]:
                if "dataset_text_field =" in line:
                    continue
                if "shared_signal_event =" in line or "shared_success_count =" in line or "shared_worker_states =" in line:
                    continue
                if "cb.shared_" in line:
                    continue
                if "sampler.shared_" in line:
                    continue
                if "DataloaderStateCallback" in line:
                    # Replace whatever was there with the clean version
                    line = "        DataloaderStateCallback(output_dir, num_dataloader_workers)\n"
                new_source.append(line)
            cell["source"] = new_source

with open(notebook_path, "w") as f:
    json.dump(nb, f, indent=2)

print("Notebook completely synchronized.")
