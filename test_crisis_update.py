#!/usr/bin/env python3
"""
Test script to verify the updated crisis intervention system
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai'))

from integration.crisis_intervention_system import CrisisDetectionEngine, RiskLevel

def test_updated_system():
    """Test that the updated crisis system uses collaborative language"""
    
    # Initialize the detection engine
    engine = CrisisDetectionEngine()
    
    # Test a high-risk message
    test_message = "I've been having thoughts about hurting myself"
    assessment = engine.assess_crisis_risk(test_message)
    
    print(f"Risk Level: {assessment.risk_level}")
    print(f"Intervention Type: {assessment.intervention_needed}")
    print(f"Risk Factors: {assessment.risk_factors}")
    
    # Verify it's using the new collaborative intervention types
    assert assessment.intervention_needed.name in ['PEER_SUPPORT', 'COMMUNITY_CONNECTION', 'COLLABORATIVE_SUPPORT']
    
    print("✅ Crisis system updated successfully - using collaborative support approach")
    return True

if __name__ == "__main__":
    test_updated_system()