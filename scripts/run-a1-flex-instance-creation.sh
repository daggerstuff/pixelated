#!/bin/bash
# Helper script to run A1.Flex instance creation in background
# This will keep trying all regions every 6 hours until successful

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/create-a1-flex-instance-multi-region.sh"
LOG_FILE="$HOME/.oci/a1-flex-instance-creation.log"
PID_FILE="$HOME/.oci/a1-flex-instance-creation.pid"

case "${1:-}" in
    start)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "⚠️  Process already running (PID: $PID)"
                exit 1
            else
                rm -f "$PID_FILE"
            fi
        fi
        
        echo "🚀 Starting A1.Flex instance creation in background..."
        nohup "$SCRIPT" >> "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        echo "✅ Started (PID: $(cat "$PID_FILE"))"
        echo "📋 Log file: $LOG_FILE"
        echo ""
        echo "To check status: $0 status"
        echo "To stop: $0 stop"
        ;;
    
    stop)
        if [ ! -f "$PID_FILE" ]; then
            echo "⚠️  No PID file found. Process may not be running."
            exit 1
        fi
        
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "🛑 Stopping process (PID: $PID)..."
            kill "$PID"
            rm -f "$PID_FILE"
            echo "✅ Stopped"
        else
            echo "⚠️  Process not running"
            rm -f "$PID_FILE"
        fi
        ;;
    
    status)
        if [ ! -f "$PID_FILE" ]; then
            echo "❌ Not running (no PID file)"
            exit 1
        fi
        
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Running (PID: $PID)"
            echo ""
            echo "Last 10 lines of log:"
            tail -10 "$LOG_FILE" 2>/dev/null || echo "No log file yet"
        else
            echo "❌ Not running (PID file exists but process not found)"
            rm -f "$PID_FILE"
        fi
        ;;
    
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "No log file found: $LOG_FILE"
        fi
        ;;
    
    *)
        echo "Usage: $0 {start|stop|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start  - Start the instance creation process in background"
        echo "  stop   - Stop the running process"
        echo "  status - Check if the process is running"
        echo "  logs   - Follow the log file"
        exit 1
        ;;
esac

