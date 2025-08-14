"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('leann.listIndexes', async () => {
        const result = await callMcpTool('leann_list', {});
        showResult('LEANN Indexes', result);
    }), vscode.commands.registerCommand('leann.semanticSearch', async () => {
        const indexId = await vscode.window.showInputBox({ prompt: 'Index ID' });
        const query = await vscode.window.showInputBox({ prompt: 'Search query' });
        if (!indexId || !query)
            return;
        const result = await callMcpTool('leann_search', { indexId, query });
        showResult('LEANN Semantic Search', result);
    }), vscode.commands.registerCommand('leann.askQuestion', async () => {
        const indexId = await vscode.window.showInputBox({ prompt: 'Index ID' });
        const question = await vscode.window.showInputBox({ prompt: 'Question' });
        if (!indexId || !question)
            return;
        const result = await callMcpTool('leann_ask', { indexId, question });
        showResult('LEANN Q&A', result);
    }));
}
async function callMcpTool(tool, args) {
    // This assumes the MCP server is running and accessible via CLI
    // For a real extension, use a persistent connection (e.g., TCP or stdio)
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('node', ['../build/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
        let output = '';
        proc.stdout.on('data', (data) => (output += data.toString()));
        proc.stderr.on('data', (data) => (output += data.toString()));
        proc.on('close', () => resolve(output));
        // Send a minimal MCP tool call request (stub, for demo)
        proc.stdin.write(JSON.stringify({ tool, args }) + '\n');
        proc.stdin.end();
    });
}
function showResult(title, result) {
    const panel = vscode.window.createOutputChannel(title);
    panel.appendLine(result);
    panel.show();
}
function deactivate() { }
//# sourceMappingURL=extension.js.map