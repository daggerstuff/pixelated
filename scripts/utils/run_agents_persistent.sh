#!/bin/bash

# AI Agents Persistent Runner
# This script sets up tmux sessions to run AI agents persistently for task execution

SESSION_NAME="ai-agents"
CONDA_ENV="pixel"
WORKSPACE_DIR="/workspaces/pixelated"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if session exists
session_exists() {
    tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

# Function to setup environment in tmux
setup_environment() {
    local session=$1
    local window=$2
    
    print_color $BLUE "🔧 Setting up environment in $window..."
    
    # Activate conda environment
    tmux send-keys -t "$session:$window" "conda activate $CONDA_ENV" C-m
    sleep 2
    
    # Navigate to workspace
    tmux send-keys -t "$session:$window" "cd $WORKSPACE_DIR" C-m
    sleep 1
}

# Function to create agent session
create_agent_session() {
    print_color $GREEN "🚀 Creating AI Agents tmux session: $SESSION_NAME"
    
    # Create new session with first window for task-master
    tmux new-session -d -s "$SESSION_NAME" -n "taskmaster" -c "$WORKSPACE_DIR"
    setup_environment "$SESSION_NAME" "taskmaster"
    
    # Create window for MCP server
    tmux new-window -t "$SESSION_NAME" -n "mcp-server" -c "$WORKSPACE_DIR"
    setup_environment "$SESSION_NAME" "mcp-server"
    
    # Create window for agent execution
    tmux new-window -t "$SESSION_NAME" -n "agent-work" -c "$WORKSPACE_DIR"
    setup_environment "$SESSION_NAME" "agent-work"
    
    # Create window for monitoring/logs
    tmux new-window -t "$SESSION_NAME" -n "monitoring" -c "$WORKSPACE_DIR"
    setup_environment "$SESSION_NAME" "monitoring"
    
    print_color $CYAN "📋 Setting up windows..."
    
    # Setup taskmaster window
    tmux send-keys -t "$SESSION_NAME:taskmaster" "# TaskMaster Commands Window" C-m
    tmux send-keys -t "$SESSION_NAME:taskmaster" "# Available commands:" C-m
    tmux send-keys -t "$SESSION_NAME:taskmaster" "# task-master list" C-m
    tmux send-keys -t "$SESSION_NAME:taskmaster" "# task-master next" C-m
    tmux send-keys -t "$SESSION_NAME:taskmaster" "# task-master set-status --id=X --status=done" C-m
    tmux send-keys -t "$SESSION_NAME:taskmaster" "echo '🎯 TaskMaster ready - use this window for task management'" C-m
    
    # Setup MCP server window (if needed)
    tmux send-keys -t "$SESSION_NAME:mcp-server" "# MCP Server Window" C-m
    tmux send-keys -t "$SESSION_NAME:mcp-server" "echo '🔌 MCP Server window - start any persistent services here'" C-m
    
    # Setup agent work window
    tmux send-keys -t "$SESSION_NAME:agent-work" "# AI Agent Work Window" C-m
    tmux send-keys -t "$SESSION_NAME:agent-work" "echo '🤖 Agent execution window - run your development tasks here'" C-m
    
    # Setup monitoring window
    tmux send-keys -t "$SESSION_NAME:monitoring" "# Monitoring & Logs" C-m
    tmux send-keys -t "$SESSION_NAME:monitoring" "echo '📊 Monitoring window - watch logs and system status'" C-m
    tmux send-keys -t "$SESSION_NAME:monitoring" "# You can run: watch -n 5 'task-master list'" C-m
    
    # Start with taskmaster window
    tmux select-window -t "$SESSION_NAME:taskmaster"
    
    print_color $GREEN "✅ AI Agents session created with windows:"
    print_color $YELLOW "   • taskmaster: Task management commands"
    print_color $YELLOW "   • mcp-server: MCP server and services"
    print_color $YELLOW "   • agent-work: AI agent execution"
    print_color $YELLOW "   • monitoring: Logs and system monitoring"
    echo
    print_color $CYAN "🎮 Controls:"
    print_color $WHITE "   Attach: tmux attach-session -t $SESSION_NAME"
    print_color $WHITE "   Switch windows: Ctrl+b, then 0-3"
    print_color $WHITE "   Detach: Ctrl+b, then d"
    print_color $WHITE "   List sessions: tmux list-sessions"
    print_color $WHITE "   Kill session: tmux kill-session -t $SESSION_NAME"
}

# Function to attach to existing session
attach_session() {
    print_color $BLUE "📎 Attaching to existing session: $SESSION_NAME"
    tmux attach-session -t "$SESSION_NAME"
}

# Function to show session status
show_status() {
    if session_exists; then
        print_color $GREEN "✅ Session '$SESSION_NAME' is running"
        print_color $CYAN "Windows:"
        tmux list-windows -t "$SESSION_NAME" -F "   #{window_index}: #{window_name} - #{window_flags}"
    else
        print_color $RED "❌ Session '$SESSION_NAME' is not running"
    fi
}

# Function to run automated task execution
start_automated_execution() {
    if ! session_exists; then
        print_color $RED "❌ No session found. Create session first."
        return 1
    fi
    
    print_color $BLUE "🤖 Starting automated task execution..."
    
    # Create automation script in the agent-work window
    tmux send-keys -t "$SESSION_NAME:agent-work" "cat << 'EOF' > /tmp/auto_execute.sh
#!/bin/bash

# Automated Task Execution Script
echo '🚀 Starting automated task execution...'

while true; do
    echo '⏰ \$(date): Checking for next task...'
    
    # Get next task
    NEXT_TASK=\$(task-master next 2>/dev/null | grep -E '^Next task:' || echo '')
    
    if [[ -n \"\$NEXT_TASK\" ]]; then
        echo \"📋 Found task: \$NEXT_TASK\"
        echo \"💭 Ready for AI agent to process...\"
        
        # Here you would integrate with your AI agent
        # For now, just log and wait
        echo \"⏳ Waiting for manual processing or AI integration...\"
    else
        echo \"✅ No pending tasks found\"
    fi
    
    # Wait 30 seconds before checking again
    sleep 30
done
EOF" C-m
    
    tmux send-keys -t "$SESSION_NAME:agent-work" "chmod +x /tmp/auto_execute.sh" C-m
    tmux send-keys -t "$SESSION_NAME:agent-work" "/tmp/auto_execute.sh" C-m
    
    print_color $GREEN "✅ Automated execution started in agent-work window"
}

# Function to setup monitoring
start_monitoring() {
    if ! session_exists; then
        print_color $RED "❌ No session found. Create session first."
        return 1
    fi
    
    print_color $BLUE "📊 Starting task monitoring..."
    
    # Start continuous monitoring in monitoring window
    tmux send-keys -t "$SESSION_NAME:monitoring" "watch -n 10 'echo \"=== Task Status === \$(date)\" && task-master list --with-subtasks'" C-m
    
    print_color $GREEN "✅ Task monitoring started in monitoring window"
}

# Main script logic
case "${1:-}" in
    "create")
        if session_exists; then
            print_color $YELLOW "⚠️ Session '$SESSION_NAME' already exists!"
            show_status
        else
            create_agent_session
        fi
        ;;
    "attach")
        if session_exists; then
            attach_session
        else
            print_color $RED "❌ No session found. Run: $0 create"
        fi
        ;;
    "status")
        show_status
        ;;
    "kill")
        if session_exists; then
            tmux kill-session -t "$SESSION_NAME"
            print_color $GREEN "✅ Session killed"
        else
            print_color $RED "❌ No session to kill"
        fi
        ;;
    "auto")
        start_automated_execution
        ;;
    "monitor")
        start_monitoring
        ;;
    "restart")
        if session_exists; then
            tmux kill-session -t "$SESSION_NAME"
            print_color $YELLOW "🔄 Killed existing session"
        fi
        create_agent_session
        ;;
    *)
        print_color $CYAN "🤖 AI Agents Persistent Runner"
        echo
        print_color $WHITE "Usage: $0 {create|attach|status|kill|auto|monitor|restart}"
        echo
        print_color $YELLOW "Commands:"
        print_color $WHITE "  create   - Create new agent session with multiple windows"
        print_color $WHITE "  attach   - Attach to existing session"
        print_color $WHITE "  status   - Show session status"
        print_color $WHITE "  kill     - Kill the session"
        print_color $WHITE "  auto     - Start automated task execution"
        print_color $WHITE "  monitor  - Start task monitoring"
        print_color $WHITE "  restart  - Kill and recreate session"
        echo
        print_color $CYAN "Example workflow:"
        print_color $WHITE "  1. $0 create     # Create persistent session"
        print_color $WHITE "  2. $0 attach     # Attach to work on tasks"
        print_color $WHITE "  3. Ctrl+b, d     # Detach (keeps running)"
        print_color $WHITE "  4. $0 monitor    # Start monitoring (optional)"
        ;;
esac 