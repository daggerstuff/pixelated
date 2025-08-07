#!/bin/bash

# Deployment Memory Manager using OpenMemory MCP Server
# Tracks deployment history, configurations, and troubleshooting information

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
OPENMEMORY_URL="http://localhost:3001"
COMMAND=${1:-"help"}

# Check if OpenMemory is available
check_openmemory() {
    if ! curl -s "$OPENMEMORY_URL/health" &> /dev/null; then
        print_error "OpenMemory MCP server not accessible at $OPENMEMORY_URL"
        print_error "Please ensure the OpenMemory MCP server is running"
        exit 1
    fi
    print_status "✅ OpenMemory MCP server accessible"
}

# Store deployment information
store_deployment() {
    print_header "Storing deployment information in OpenMemory..."
    
    local deployment_type="$1"
    local details="$2"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local memory_content="[$timestamp] Pixelated Empathy $deployment_type: $details"
    
    # Store in OpenMemory
    local response=$(curl -s -X POST "$OPENMEMORY_URL/memory" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$memory_content\"}")
    
    if echo "$response" | grep -q "success\|id"; then
        print_status "✅ Deployment information stored successfully"
    else
        print_error "❌ Failed to store deployment information"
        echo "Response: $response"
    fi
}

# Search deployment history
search_deployments() {
    print_header "Searching deployment history..."
    
    local query="${1:-Pixelated Empathy}"
    
    local response=$(curl -s -X GET "$OPENMEMORY_URL/memory/search?q=$query")
    
    if echo "$response" | jq -e '.memories' &> /dev/null; then
        print_status "📋 Deployment History:"
        echo "$response" | jq -r '.memories[] | "• " + .content' | head -10
    else
        print_warning "No deployment history found for query: $query"
    fi
}

# Store Oracle Cloud configuration
store_oracle_config() {
    print_header "Storing Oracle Cloud configuration..."
    
    if [[ ! -f ".oracle_deployment" ]]; then
        print_error "No Oracle deployment configuration found"
        return 1
    fi
    
    source .oracle_deployment
    
    local config_memory="Oracle Cloud configuration: Instance IP $PUBLIC_IP, SSH key $SSH_KEY_PATH, Instance ID $INSTANCE_OCID. Always Free tier with 4 ARM CPUs and 24GB RAM."
    
    store_deployment "configuration" "$config_memory"
}

# Store troubleshooting information
store_troubleshooting() {
    print_header "Storing troubleshooting information..."
    
    local issue="$1"
    local solution="$2"
    
    if [[ -z "$issue" || -z "$solution" ]]; then
        print_error "Usage: $0 troubleshoot \"issue description\" \"solution\""
        return 1
    fi
    
    local troubleshoot_memory="Troubleshooting: Issue - $issue. Solution - $solution. Pixelated Empathy Oracle Cloud deployment."
    
    store_deployment "troubleshooting" "$troubleshoot_memory"
}

# Store database migration information
store_database_migration() {
    print_header "Storing database migration information..."
    
    local migration_details="$1"
    
    if [[ -z "$migration_details" ]]; then
        migration_details="Database migration completed for Pixelated Empathy conversations and user data"
    fi
    
    store_deployment "database migration" "$migration_details"
}

# Store API configuration
store_api_config() {
    print_header "Storing API configuration..."
    
    local api_details="$1"
    
    if [[ -z "$api_details" ]]; then
        api_details="API configuration updated with new endpoints and authentication settings"
    fi
    
    store_deployment "API configuration" "$api_details"
}

# Get deployment status
get_deployment_status() {
    print_header "Getting current deployment status..."
    
    # Search for recent deployments
    local recent_deployments=$(curl -s -X GET "$OPENMEMORY_URL/memory/search?q=Pixelated%20Empathy%20deployment")
    
    if echo "$recent_deployments" | jq -e '.memories[0]' &> /dev/null; then
        print_status "📊 Latest Deployment Information:"
        echo "$recent_deployments" | jq -r '.memories[0].content'
        
        print_status "📈 Recent Activity:"
        echo "$recent_deployments" | jq -r '.memories[0:3][] | "• " + .content'
    else
        print_warning "No deployment status found in memory"
    fi
}

# Store bottleneck resolution progress
store_bottleneck_progress() {
    print_header "Storing bottleneck resolution progress..."
    
    local progress="$1"
    
    if [[ -z "$progress" ]]; then
        progress="Bottleneck resolution tasks completed: database migration, containerization, monitoring setup"
    fi
    
    store_deployment "bottleneck resolution" "$progress"
}

# Export deployment memories
export_memories() {
    print_header "Exporting deployment memories..."
    
    local output_file="deployment_memories_$(date +%Y%m%d_%H%M%S).json"
    
    curl -s -X GET "$OPENMEMORY_URL/memory/search?q=Pixelated%20Empathy" > "$output_file"
    
    if [[ -f "$output_file" ]]; then
        print_status "✅ Deployment memories exported to: $output_file"
        
        # Create human-readable version
        local readable_file="deployment_memories_$(date +%Y%m%d_%H%M%S).md"
        echo "# Pixelated Empathy Deployment Memories" > "$readable_file"
        echo "" >> "$readable_file"
        echo "Generated on: $(date)" >> "$readable_file"
        echo "" >> "$readable_file"
        
        jq -r '.memories[] | "## " + (.timestamp // "Unknown Date") + "\n\n" + .content + "\n"' "$output_file" >> "$readable_file"
        
        print_status "✅ Human-readable export created: $readable_file"
    else
        print_error "❌ Failed to export deployment memories"
    fi
}

# Show help
show_help() {
    echo "Deployment Memory Manager for Pixelated Empathy"
    echo ""
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  store <type> <details>     Store deployment information"
    echo "  search [query]             Search deployment history"
    echo "  status                     Get current deployment status"
    echo "  oracle-config              Store Oracle Cloud configuration"
    echo "  database-migration [info]  Store database migration info"
    echo "  api-config [info]          Store API configuration info"
    echo "  bottleneck [progress]      Store bottleneck resolution progress"
    echo "  troubleshoot <issue> <sol> Store troubleshooting information"
    echo "  export                     Export all deployment memories"
    echo "  help                       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 store deployment \"Oracle Cloud instance created with IP 1.2.3.4\""
    echo "  $0 search \"database\""
    echo "  $0 troubleshoot \"Container won't start\" \"Check Docker logs and restart\""
    echo "  $0 oracle-config"
    echo "  $0 export"
}

# Main execution
main() {
    case "$COMMAND" in
        "store")
            check_openmemory
            store_deployment "$2" "$3"
            ;;
        "search")
            check_openmemory
            search_deployments "$2"
            ;;
        "status")
            check_openmemory
            get_deployment_status
            ;;
        "oracle-config")
            check_openmemory
            store_oracle_config
            ;;
        "database-migration")
            check_openmemory
            store_database_migration "$2"
            ;;
        "api-config")
            check_openmemory
            store_api_config "$2"
            ;;
        "bottleneck")
            check_openmemory
            store_bottleneck_progress "$2"
            ;;
        "troubleshoot")
            check_openmemory
            store_troubleshooting "$2" "$3"
            ;;
        "export")
            check_openmemory
            export_memories
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

main "$@"
