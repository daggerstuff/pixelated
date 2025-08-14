# How to Load and Test the LEANN VSCode Extension

## 1. Build the Extension

Open a terminal in `external/leann-server/vscode-extension` and run:

```bash
npm install
npm run compile
```

## 2. Open the Extension in VSCode

- In VSCode, select **File > Add Folder to Workspace...** and choose the `vscode-extension` folder.
- Or, open VSCode directly in that folder:
  ```bash
  code external/leann-server/vscode-extension
  ```

## 3. Start a VSCode Extension Development Host

- Press `F5` (or select **Run > Start Debugging**) in VSCode.
- This launches a new VSCode window ("Extension Development Host") with your extension loaded.

## 4. Use the Extension

- Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
- Type `LEANN:` to see the available commands:
  - **LEANN: List Indexes**
  - **LEANN: Semantic Search**
  - **LEANN: Ask Question**
- Select a command and follow the prompts.

## 5. Make Changes

- Edit files in `src/` and re-run `npm run compile` as needed.
- Reload the Extension Development Host window to see changes.

## 6. Packaging (Optional)

To package the extension for distribution, install `vsce` and run:

```bash
npm install -g vsce
vsce package
```

This will create a `.vsix` file you can install in VSCode.
