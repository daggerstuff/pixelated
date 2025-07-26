# 🤖 Persistent AI Agents Guide

This guide shows you how to run your AI agents and task execution persistently using tmux, so they continue working even when your PC disconnects from the remote Linux machine.

## 🎯 Quick Start

### 1. Create Persistent Session
```bash
./scripts/run_agents_persistent.sh create
```

This creates a tmux session called "ai-agents" with 4 windows:
- **taskmaster**: For TaskMaster commands
- **mcp-server**: For MCP server and services  
- **agent-work**: For AI agent execution
- **monitoring**: For logs and system monitoring

### 2. Attach to Session
```bash
./scripts/run_agents_persistent.sh attach
```

### 3. Detach (Keeps Running)
Press `Ctrl+b`, then `d` to detach while keeping everything running.

### 4. Check Session Status
```bash
./scripts/run_agents_persistent.sh status
```

## 🛠️ Complete Workflow

### Step 1: Initial Setup
```bash
# Create the persistent session
./scripts/run_agents_persistent.sh create

# This will show you the session is created with multiple windows
```

### Step 2: Start Working
```bash
# Attach to the session
./scripts/run_agents_persistent.sh attach

# You'll be in the taskmaster window
# Switch between windows: Ctrl+b, then 0-3
```

### Step 3: Window Usage

#### TaskMaster Window (Window 0)
```bash
# Check current tasks
task-master list

# Get next task
task-master next

# Set task status
task-master set-status --id=1 --status=done

# Expand tasks
task-master expand --id=1 --research
```

#### Agent Work Window (Window 2)
```bash
# Run automated agent processing
python scripts/agent_automation.py run --interval 60

# Or run single check
python scripts/agent_automation.py check

# Run with verbose logging
python scripts/agent_automation.py run --verbose
```

#### Monitoring Window (Window 3)
```bash
# Start continuous monitoring
./scripts/run_agents_persistent.sh monitor

# Or manual monitoring
watch -n 30 'task-master list --with-subtasks'

# View logs
tail -f logs/agent_automation.log
```

### Step 4: Detach and Leave Running
```bash
# Detach from session (Ctrl+b, then d)
# OR just close your terminal/disconnect your PC
# The session keeps running on the remote machine!
```

### Step 5: Reconnect Later
```bash
# Reconnect to your session anytime
./scripts/run_agents_persistent.sh attach

# Check what happened while you were away
./scripts/run_agents_persistent.sh status
```

## 🚀 Automation Options

### Automated Task Processing
```bash
# In the agent-work window, start automation:
python scripts/agent_automation.py run --interval 30

# This will:
# - Check for tasks every 30 seconds
# - Process available tasks automatically
# - Log all activity
# - Handle interruptions gracefully
```

### Task Monitoring
```bash
# In the monitoring window:
python scripts/agent_automation.py monitor

# This provides a live dashboard of task status
```

## 🎮 tmux Controls

### Basic Navigation
- `Ctrl+b, 0-3`: Switch to window 0, 1, 2, or 3
- `Ctrl+b, n`: Next window
- `Ctrl+b, p`: Previous window
- `Ctrl+b, l`: Last window
- `Ctrl+b, d`: Detach session

### Session Management
```bash
# List all sessions
tmux list-sessions

# Attach to specific session
tmux attach-session -t ai-agents

# Kill session
tmux kill-session -t ai-agents
```

### Window Management
- `Ctrl+b, c`: Create new window
- `Ctrl+b, &`: Kill current window
- `Ctrl+b, ,`: Rename current window

## 🔄 Advanced Usage

### Multiple Agent Sessions
```bash
# Run multiple specialized sessions
SESSION_NAME="ai-agents-dev" ./scripts/run_agents_persistent.sh create
SESSION_NAME="ai-agents-prod" ./scripts/run_agents_persistent.sh create

# Attach to specific session
tmux attach-session -t ai-agents-dev
```

### Custom Automation Scripts
Create your own automation scripts in the `agent-work` window:

```bash
# Create a custom script
cat > /tmp/my_automation.sh << 'EOF'
#!/bin/bash
while true; do
    echo "$(date): Checking tasks..."
    task-master next
    sleep 60
done
EOF

chmod +x /tmp/my_automation.sh
/tmp/my_automation.sh
```

### Integration with Your AI Agent
Modify `scripts/agent_automation.py` to integrate with your specific AI agent:

```python
def process_task(self, task: Dict[str, Any]) -> bool:
    """Custom task processing logic"""
    # Your AI agent integration here
    # - Parse task requirements
    # - Call your AI model
    # - Execute the solution
    # - Verify results
    # - Update task status
    pass
```

## 📊 Monitoring and Logs

### View Logs
```bash
# Agent automation logs
tail -f logs/agent_automation.log

# TaskMaster logs
ls -la tasks/logs/

# System logs
journalctl -u tmux
```

### Check Resource Usage
```bash
# In monitoring window
htop
```

### Task Statistics
```bash
# Get task summary
task-master list | grep -E "(pending|done|in-progress)"
```

## ⚠️ Important Notes

1. **Session Persistence**: tmux sessions survive:
   - Terminal disconnection
   - SSH disconnection  
   - PC shutdown/restart
   - Network interruptions

2. **Resource Management**: 
   - Monitor CPU/memory usage in long-running sessions
   - Use `htop` or `top` to check system resources
   - Consider task intervals to avoid overwhelming the system

3. **Error Handling**:
   - Automation scripts include signal handling for graceful shutdown
   - Check logs regularly for any issues
   - Use `--verbose` flag for debugging

4. **Security**:
   - Sessions run under your user account
   - API keys are read from environment/config files
   - Consider using screen locks for sensitive work

## 🆘 Troubleshooting

### Session Not Found
```bash
# Check if tmux is running
ps aux | grep tmux

# List all sessions
tmux list-sessions

# Recreate session
./scripts/run_agents_persistent.sh restart
```

### Task Processing Stopped
```bash
# Check automation process
ps aux | grep agent_automation

# Restart automation in agent-work window
python scripts/agent_automation.py run
```

### High Resource Usage
```bash
# Check system resources
htop

# Reduce check intervals
python scripts/agent_automation.py run --interval 120
```

### Logs Not Updating
```bash
# Check log directory permissions
ls -la logs/

# Create logs directory if missing
mkdir -p logs

# Check disk space
df -h
```

## 🎉 Benefits

✅ **Persistent Execution**: Keep working even when disconnected  
✅ **Multiple Windows**: Organized workspace for different tasks  
✅ **Automated Processing**: Let AI agents work autonomously  
✅ **Real-time Monitoring**: Track progress and system status  
✅ **Graceful Recovery**: Handle interruptions and errors  
✅ **Resource Efficient**: Minimal overhead, maximum productivity  

Now you can safely disconnect your PC and let your AI agents continue working on their task lists! 🚀 