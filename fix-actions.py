import json

with open('.github/actions/prepare-uv-venv/action.yml', 'r') as f:
    content = f.read()

# Fix working directory and grep pattern
new_content = content.replace(
    '      shell: bash',
    '      shell: bash\n      working-directory: ${{ inputs.service-dir }}'
).replace(
    '''        if command -v pyenv &> /dev/null && ! pyenv versions --bare | grep -q "^$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"; then''',
    '''        py_mm="$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"\n        if command -v pyenv &> /dev/null && ! pyenv versions --bare | grep -Eq "^${py_mm}(\\.|$)"; then'''
)

with open('.github/actions/prepare-uv-venv/action.yml', 'w') as f:
    f.write(new_content)
