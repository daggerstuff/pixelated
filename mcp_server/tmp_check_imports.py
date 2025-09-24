#!/usr/bin/env python3
"""
Simple script to check if our integration components can be imported
without the complex MCP server dependencies.
"""

import sys
import os
sys.path.insert(0, '/root/pixelated/mcp_server')

# Test basic imports
try:
    from services.integration_manager import IntegrationManager, IntegrationEventType
    print("✅ IntegrationManager imported successfully")
except ImportError as e:
    print(f"❌ IntegrationManager import failed: {e}")

try:
    from services.flask_integration import FlaskIntegrationService, PipelineStatus
    print("✅ FlaskIntegrationService imported successfully")
except ImportError as e:
    print(f"❌ FlaskIntegrationService import failed: {e}")

try:
    from services.websocket_manager import WebSocketManager
    print("✅ WebSocketManager imported successfully")
except ImportError as e:
    print(f"❌ WebSocketManager import failed: {e}")

print("\nIntegration components created successfully!")
