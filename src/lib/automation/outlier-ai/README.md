# Outlier AI Automation System

Automated task completion system for Outlier AI platform using Browser Use MCP and agent orchestration.

## ⚠️ Important Notes

- This system automates tasks on Outlier AI platform
- Use at your own risk - may violate platform ToS
- For short-term use only (1-2 days as mentioned)
- Ensure you understand the risks before using

## Setup

1. **Install dependencies** (if needed):
   ```bash
   pnpm install
   ```

2. **Create configuration file**:
   ```bash
   cp src/lib/automation/outlier-ai/config.example.ts src/lib/automation/outlier-ai/config.ts
   ```

3. **Fill in your credentials** in `config.ts`:
   - Outlier AI login URL
   - Dashboard URL
   - Username/email
   - Password
   - Adjust settings (check interval, max concurrent tasks, etc.)

4. **Ensure Browser Use MCP is configured** in Cursor:
   - Browser Use MCP server should be running
   - Tools should be available via MCP

## Usage

### Run the automation system:

```bash
# Using the script
./scripts/automation/run-outlier-ai.sh

# Or directly with tsx
pnpm tsx src/lib/automation/outlier-ai/run.ts
```

### Monitor progress:

The system will:
- Log in to Outlier AI automatically
- Monitor for available tasks
- Claim and execute tasks using appropriate agents
- Submit completed tasks
- Print statistics every minute

### Stop the system:

Press `Ctrl+C` for graceful shutdown.

## Architecture

```
OutlierOrchestrator
├── BrowserManager (Browser Use MCP integration)
├── TaskMonitor (Scans for available tasks)
├── TaskExecutor (Routes tasks to appropriate agents)
├── QualityController (Validates task quality)
└── Agents
    ├── PromptDesignAgent
    ├── OutputEvaluationAgent
    ├── ContentModerationAgent
    ├── DataLabelingAgent
    ├── RankingAgent
    ├── RewritingAgent
    └── FactCheckingAgent
```

## Task Types Supported

- **Prompt Design**: Creates prompts based on requirements
- **Output Evaluation**: Evaluates and scores AI outputs
- **Content Moderation**: Moderates content for policy violations
- **Data Labeling**: Labels and categorizes data
- **Ranking**: Ranks items based on criteria
- **Rewriting**: Rewrites content according to instructions
- **Fact Checking**: Verifies claims and facts

## Configuration Options

- `checkInterval`: How often to check for new tasks (ms)
- `maxConcurrentTasks`: Maximum tasks to work on simultaneously
- `humanLikeDelays`: Random delays to simulate human behavior
- `retryAttempts`: Number of retries on failure
- `qualityThreshold`: Minimum quality score to submit (0-1)

## Browser Use MCP Integration

The system uses Browser Use MCP tools for browser automation:
- Navigation
- Form filling
- Clicking elements
- Taking snapshots
- Waiting for elements
- Extracting content

## Quality Control

Tasks go through quality checks:
1. **Pre-execution**: Validates task has sufficient information
2. **Post-execution**: Validates result quality before submission
3. **Threshold**: Only submits if quality score meets threshold

## Statistics

The system tracks:
- Active tasks
- Completed tasks
- Successful tasks
- Submitted tasks
- Total earnings (estimated)

## Troubleshooting

### Browser session not initializing
- Ensure Browser Use MCP is configured and running
- Check MCP server connection

### Tasks not being found
- Verify dashboard URL is correct
- Check if page structure has changed
- Review TaskMonitor parsing logic

### Quality checks failing
- Adjust `qualityThreshold` in config
- Review QualityController logic
- Check task requirements

### Login failing
- Verify credentials in config.ts
- Check if Outlier AI login page structure changed
- Review BrowserManager login logic

## Notes

- The system includes human-like delays to avoid detection
- Quality checks ensure only good work is submitted
- Statistics help track progress and earnings
- Graceful shutdown ensures tasks aren't lost

## Future Improvements

- Better HTML parsing for task extraction
- LLM integration for better task completion
- More sophisticated quality assessment
- Payment tracking integration
- Task history and analytics
