import * as vscode from 'vscode';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('leann.listIndexes', async () => {
      const result = await callMcpTool('leann_list', {});
      showResult('LEANN Indexes', result);
    }),

    vscode.commands.registerCommand('leann.semanticSearch', async () => {
      const indexId = await vscode.window.showInputBox({ prompt: 'Index ID' });
      const query = await vscode.window.showInputBox({ prompt: 'Search query' });
      if (!indexId || !query) return;
      const result = await callMcpTool('leann_search', { indexId, query });
      showResult('LEANN Semantic Search', result);
    }),

    vscode.commands.registerCommand('leann.askQuestion', async () => {
      const indexId = await vscode.window.showInputBox({ prompt: 'Index ID' });
      const question = await vscode.window.showInputBox({ prompt: 'Question' });
      if (!indexId || !question) return;
      const result = await callMcpTool('leann_ask', { indexId, question });
      showResult('LEANN Q&A', result);
    })
  );
}

async function callMcpTool(tool: string, args: any): Promise<string> {
  // This assumes the MCP server is running and accessible via CLI
  // For a real extension, use a persistent connection (e.g., TCP or stdio)
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['../build/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', (data) => (output += data.toString()));
    proc.stderr.on('data', (data) => (output += data.toString()));
    proc.on('close', () => resolve(output));
    // Send a minimal MCP tool call request (stub, for demo)
    proc.stdin.write(JSON.stringify({ tool, args }) + '\n');
    proc.stdin.end();
  });
}

function showResult(title: string, result: string) {
  const panel = vscode.window.createOutputChannel(title);
  panel.appendLine(result);
  panel.show();
}

export function deactivate() {}