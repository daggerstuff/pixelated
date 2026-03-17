import re

file_path = ".github/workflows/copilot-setup-steps.yml"

with open(file_path, "r") as f:
    content = f.read()

setup_node = """    - name: Set up Node.js
      uses: actions/setup-node@v5
      with:
        node-version: "24"
        cache: "pnpm"
"""

setup_pnpm = """    - name: Install pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.17.1
"""

# Wait, the memory states: "To avoid 'ERR_PNPM_BAD_PM_VERSION' and Corepack download failures in CI environments... the PNPM version must be synchronized to '10.30.1' across all project configuration and workflow files."
# I should also update the pnpm version.

setup_pnpm_fixed = """    - name: Install pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.30.1
"""

content = content.replace(setup_node, "")
content = content.replace(setup_pnpm, "")

# Insert them in the correct order
replacement = setup_pnpm_fixed + "\n" + setup_node
content = content.replace("    - name: Install dependencies", replacement + "    - name: Install dependencies")

with open(file_path, "w") as f:
    f.write(content)

print("Modification complete.")
