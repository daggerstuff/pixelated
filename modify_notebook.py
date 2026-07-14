import json

path = "/home/vivi/pixelated/ai/training/ready_packages/platforms/colab/colab_unsloth_finetuning.ipynb"
with open(path) as f:
    nb = json.load(f)

# Clear the source of the first two code cells
code_cells = [c for c in nb["cells"] if c["cell_type"] == "code"]
if len(code_cells) >= 2:
    code_cells[0]["source"] = []
    code_cells[1]["source"] = []

with open(path, "w") as f:
    json.dump(nb, f, indent=2)
