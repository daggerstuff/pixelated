"""
Test configuration for integration tests
Provides test data, fixtures, and configuration for all integration tests
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Test environment configuration
TEST_ENVIRONMENT = {
    "environment": "test",
    "debug": True,
    "log_level": "DEBUG",
    "mock_external_services": True,
    "use_test_databases": True
}

# IEEE Xplore test configuration
IEEE_TEST_CONFIG = {
    "api_key": "test_ieee_api_key_12345",
    "base_url": "https://ieeexploreapi.ieee.org/api/v1",
    "rate_limit": 10,
    "timeout": 30,
    "max_retries": 3,
    "test_queries": [
        "bias detection machine learning",
        "fairness in artificial intelligence",
        "ethical AI systems",
        "algorithmic accountability",
        "cultural competency in AI"
    ],
    "expected_response_structure": {
        "articles": ["title", "authors", "abstract", "keywords", "publication_year"],
        "total_records": int,
        "total_pages": int
    }
}

# Training test configuration
TRAINING_TEST_CONFIG = {
    "cultural_competency": {
        "cultural_contexts": ["asian", "hispanic", "african", "middle_eastern", "european"],
        "communication_styles": ["direct", "indirect", "high_context", "low_context"],
        "power_distance_levels": ["high", "low"],
        "uncertainty_avoidance": ["high", "low"],
        "scenario_count": 50,
        "difficulty_levels": ["beginner", "intermediate", "advanced"]
    },
    "trauma_informed_care": {
        "trauma_types": ["acute", "chronic", "complex", "developmental"],
        "safety_dimensions": ["physical", "emotional", "cultural", "psychological"],
        "empowerment_strategies": ["choice", "collaboration", "voice", "autonomy"],
        "trust_principles": ["transparency", "consistency", "respect", "boundaries"],
        "scenario_count": 40
    },
    "assessment": {
        "assessment_types": ["knowledge", "skill", "behavior", "attitude"],
        "scoring_methods": ["binary", "scale", "rubric", "comprehensive"],
        "time_limits": [1800, 3600, 5400],  # 30min, 60min, 90min
        "passing_scores": [0.7, 0.8, 0.85]
    }
}

# Bias detection test configuration
BIAS_DETECTION_TEST_CONFIG = {
    "real_time_analysis": {
        "window_size": 100,
        "slide_interval": 10,
        "confidence_threshold": 0.7,
        "update_frequency": 30
    },
    "feedback_loop": {
        "update_interval": 300,
        "min_feedback_samples": 10,
        "learning_rate": 0.01,
        "feedback_weight": 0.3
    },
    "performance": {
        "batch_size": 32,
        "max_workers": 8,
        "cache_ttl": 3600,
        "processing_timeout": 30.0
    },
    "bias_types": ["gender", "racial", "age", "cultural", "socioeconomic"],
    "contexts": ["hiring", "promotion", "interview", "performance_review", "team_interaction"]
}

# Memory system test configuration
MEMORY_TEST_CONFIG = {
    "update_threshold": 0.1,
    "max_batch_size": 50,
    "sync_interval": 300,
    "git_integration": {
        "auto_commit": True,
        "commit_message_template": "Memory update: {timestamp}",
        "branch_name": "memory-updates"
    },
    "file_monitoring": {
        "watch_patterns": ["*.md", "*.json", "*.yaml"],
        "exclude_patterns": ["*.log", "*.tmp", "node_modules/*"],
        "update_delay": 5
    }
}

# Test data generators
def generate_test_conversation_data(message_count: int = 10) -> Dict[str, Any]:
    """Generate test conversation data"""
    messages = []
    for i in range(message_count):
        messages.append({
            "role": "user" if i % 2 == 0 else "assistant",
            "content": f"Test message {i} about workplace dynamics and career development",
            "timestamp": (datetime.now() + timedelta(minutes=i*5)).isoformat(),
            "metadata": {
                "confidence": 0.8 + (i % 3) * 0.1,
                "sentiment": "positive" if i % 3 == 0 else "neutral" if i % 3 == 1 else "negative"
            }
        })
    
    return {
        "conversation_id": f"test_conv_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "messages": messages,
        "metadata": {
            "user_id": "test_user_123",
            "context": "career_advice",
            "duration_minutes": message_count * 5,
            "participants": 2
        }
    }

def generate_test_research_articles(count: int = 5) -> List[Dict[str, Any]]:
    """Generate test research articles"""
    articles = []
    for i in range(count):
        articles.append({
            "title": f"Research Article {i+1}: Bias Detection in AI Systems",
            "authors": [f"Author {j+1}" for j in range(3)],
            "abstract": f"This paper examines bias detection methods in AI systems. Study {i+1} focuses on...",
            "keywords": ["bias detection", "AI ethics", "machine learning", f"topic_{i}"],
            "publication_year": 2023 - (i % 3),
            "doi": f"10.1109/TEST.2023.{123456 + i}",
            "citations": 10 + i * 5,
            "relevance_score": 0.9 - (i * 0.1)
        })
    
    return articles

def generate_test_training_scenarios(scenario_type: str = "cultural", count: int = 10) -> List[Dict[str, Any]]:
    """Generate test training scenarios"""
    scenarios = []
    
    if scenario_type == "cultural":
        cultural_contexts = ["asian", "hispanic", "african", "middle_eastern"]
        for i in range(count):
            scenarios.append({
                "id": f"cultural_scenario_{i+1}",
                "cultural_context": cultural_contexts[i % len(cultural_contexts)],
                "scenario_description": f"Scenario involving {cultural_contexts[i % len(cultural_contexts)]} cultural communication",
                "learning_objectives": [
                    "Understand cultural communication differences",
                    "Practice culturally sensitive responses",
                    "Recognize cultural bias indicators"
                ],
                "difficulty_level": "intermediate" if i % 2 == 0 else "advanced",
                "estimated_time": 15 + (i * 5),
                "assessment_criteria": {
                    "cultural_awareness": 0.8,
                    "communication_effectiveness": 0.7,
                    "bias_recognition": 0.6
                }
            })
    
    elif scenario_type == "trauma":
        trauma_types = ["acute", "chronic", "complex"]
        for i in range(count):
            scenarios.append({
                "id": f"trauma_scenario_{i+1}",
                "trauma_type": trauma_types[i % len(trauma_types)],
                "scenario_description": f"Trauma-informed care scenario for {trauma_types[i % len(trauma_types)]} trauma",
                "safety_measures": [
                    "Create physical safety",
                    "Ensure emotional safety",
                    "Maintain cultural safety"
                ],
                "empowerment_strategies": [
                    "Provide choices",
                    "Encourage collaboration",
                    "Support voice and autonomy"
                ],
                "difficulty_level": "advanced",
                "sensitivity_level": "high"
            })
    
    return scenarios

def generate_test_bias_detection_results(count: int = 20) -> List[Dict[str, Any]]:
    """Generate test bias detection results"""
    results = []
    bias_types = ["gender", "racial", "age", "cultural", "socioeconomic"]
    contexts = ["hiring", "promotion", "interview", "performance_review"]
    
    for i in range(count):
        bias_type = bias_types[i % len(bias_types)]
        context = contexts[i % len(contexts)]
        
        results.append({
            "detection_id": f"detection_{i+1}",
            "bias_type": bias_type,
            "confidence": 0.5 + (i % 5) * 0.1,
            "context": context,
            "severity": "high" if i % 4 == 0 else "medium" if i % 4 == 1 else "low",
            "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
            "mitigation_applied": i % 3 == 0,
            "user_feedback": "accurate" if i % 2 == 0 else "inaccurate"
        })
    
    return results

def generate_test_memory_updates(count: int = 10) -> List[Dict[str, Any]]:
    """Generate test memory updates"""
    updates = []
    
    for i in range(count):
        updates.append({
            "update_id": f"update_{i+1}",
            "update_type": "bias_pattern" if i % 3 == 0 else "training_data" if i % 3 == 1 else "research_finding",
            "content": {
                "pattern": f"test_pattern_{i}",
                "confidence": 0.7 + (i % 3) * 0.1,
                "source": "test_source",
                "timestamp": datetime.now().isoformat()
            },
            "timestamp": datetime.now().isoformat(),
            "priority": "high" if i % 4 == 0 else "medium"
        })
    
    return updates

# Performance test configuration
PERFORMANCE_TEST_CONFIG = {
    "load_test": {
        "concurrent_users": 100,
        "requests_per_user": 10,
        "max_response_time": 2.0,
        "success_rate": 0.95
    },
    "stress_test": {
        "max_load": 1000,
        "duration_minutes": 10,
        "memory_limit_mb": 512,
        "cpu_limit_percent": 80
    },
    "endurance_test": {
        "duration_hours": 24,
        "steady_load": 50,
        "memory_leak_threshold": 10  # 10% increase allowed
    }
}

# Error simulation configuration
ERROR_TEST_CONFIG = {
    "network_errors": {
        "timeout_probability": 0.1,
        "connection_failure_probability": 0.05,
        "rate_limit_probability": 0.02
    },
    "api_errors": {
        "authentication_failure_probability": 0.01,
        "authorization_failure_probability": 0.005,
        "validation_error_probability": 0.03
    },
    "system_errors": {
        "memory_pressure_probability": 0.02,
        "disk_space_probability": 0.01,
        "cpu_throttling_probability": 0.015
    }
}

# Test validation criteria
TEST_VALIDATION_CRITERIA = {
    "functional_tests": {
        "pass_rate": 0.95,
        "coverage_minimum": 0.80,
        "execution_time_limit": 300  # 5 minutes
    },
    "integration_tests": {
        "pass_rate": 0.90,
        "external_dependency_mock_rate": 0.80,
        "data_consistency_checks": True
    },
    "performance_tests": {
        "response_time_p95": 2.0,
        "throughput_minimum": 100,  # requests per second
        "error_rate_maximum": 0.05
    },
    "security_tests": {
        "vulnerability_scan_pass": True,
        "authentication_tests_pass": True,
        "authorization_tests_pass": True
    }
}

def get_test_configuration(test_type: str) -> Dict[str, Any]:
    """Get test configuration for specific test type"""
    configurations = {
        "ieee_integration": IEEE_TEST_CONFIG,
        "training_integration": TRAINING_TEST_CONFIG,
        "bias_detection_integration": BIAS_DETECTION_TEST_CONFIG,
        "memory_integration": MEMORY_TEST_CONFIG,
        "performance": PERFORMANCE_TEST_CONFIG,
        "error_simulation": ERROR_TEST_CONFIG
    }
    
    return configurations.get(test_type, {})

def validate_test_results(test_type: str, results: Dict[str, Any]) -> bool:
    """Validate test results against criteria"""
    criteria = TEST_VALIDATION_CRITERIA.get(test_type.replace("_tests", "_tests"), {})
    
    if not criteria:
        return True  # No specific criteria defined
    
    # Check pass rate
    if "pass_rate" in criteria:
        pass_rate = results.get("pass_rate", 0)
        if pass_rate < criteria["pass_rate"]:
            return False
    
    # Check execution time
    if "execution_time_limit" in criteria:
        execution_time = results.get("execution_time", 0)
        if execution_time > criteria["execution_time_limit"]:
            return False
    
    # Check coverage
    if "coverage_minimum" in criteria:
        coverage = results.get("coverage", 0)
        if coverage < criteria["coverage_minimum"]:
            return False
    
    return True

# Environment-specific configurations
ENVIRONMENT_CONFIGS = {
    "development": {
        "mock_external_services": True,
        "use_test_databases": True,
        "log_level": "DEBUG",
        "parallel_execution": False
    },
    "testing": {
        "mock_external_services": True,
        "use_test_databases": True,
        "log_level": "INFO",
        "parallel_execution": True
    },
    "staging": {
        "mock_external_services": False,
        "use_test_databases": False,
        "log_level": "WARNING",
        "parallel_execution": True
    },
    "production": {
        "mock_external_services": False,
        "use_test_databases": False,
        "log_level": "ERROR",
        "parallel_execution": True
    }
}

def get_environment_config(environment: str) -> Dict[str, Any]:
    """Get environment-specific configuration"""
    return ENVIRONMENT_CONFIGS.get(environment, ENVIRONMENT_CONFIGS["testing"])

# Export all configurations
__all__ = [
    "TEST_ENVIRONMENT",
    "IEEE_TEST_CONFIG",
    "TRAINING_TEST_CONFIG",
    "BIAS_DETECTION_TEST_CONFIG",
    "MEMORY_TEST_CONFIG",
    "PERFORMANCE_TEST_CONFIG",
    "ERROR_TEST_CONFIG",
    "TEST_VALIDATION_CRITERIA",
    "generate_test_conversation_data",
    "generate_test_research_articles",
    "generate_test_training_scenarios",
    "generate_test_bias_detection_results",
    "generate_test_memory_updates",
    "get_test_configuration",
    "validate_test_results",
    "get_environment_config"
]