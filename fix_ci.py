import re

file_path = ".github/workflows/copilot-setup-steps.yml"

with open(file_path, "r") as f:
    content = f.read()

# remove the last step
content = re.sub(
    r'\s+- name: GitHub Copilot Code Review\n\s+uses: github/copilot-review-action@v1\n\s+with:\n\s+github-token: \${{ secrets.G_TOKEN }}\n?',
    '',
    content
)

with open(file_path, "w") as f:
    f.write(content)

file_path_dependabot = ".github/dependabot.yml"
with open(file_path_dependabot, "r") as f:
    dependabot_content = f.read()

dependabot_content = re.sub(
    r'\s+- dependency-name: \'github/copilot-review-action\'',
    '',
    dependabot_content
)

with open(file_path_dependabot, "w") as f:
    f.write(dependabot_content)

print("Modification complete.")
