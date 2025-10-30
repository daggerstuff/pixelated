#!/usr/bin/env python3
"""
API Documentation Generator
Task 5.5.3.7: Create API documentation for dataset access

This module generates comprehensive API documentation for accessing
the Pixelated Empathy AI dataset and processing system.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class APIDocumentationGenerator:
    """Generate comprehensive API documentation."""
    
    def __init__(self, base_path: str = "/home/vivi/pixelated/ai"):
        self.base_path = Path(base_path)
        self.docs_path = self.base_path / "docs"
        self.docs_path.mkdir(exist_ok=True)
        
    def generate_api_documentation(self) -> Dict[str, Any]:
        """Generate comprehensive API documentation."""
        
        documentation = {
            "title": "Pixelated Empathy AI - API Documentation",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "base_url": "https://api.pixelated-empathy.ai/v1",
            "sections": {
                "overview": self._generate_overview(),
                "authentication": self._generate_authentication(),
                "dataset_access": self._generate_dataset_access_api(),
                "quality_metrics": self._generate_quality_metrics_api(),
                "processing": self._generate_processing_api(),
                "export_formats": self._generate_export_formats_api(),
                "search": self._generate_search_api(),
                "statistics": self._generate_statistics_api(),
                "error_handling": self._generate_error_handling(),
                "rate_limits": self._generate_rate_limits(),
                "sdk_examples": self._generate_sdk_examples()
            }
        }
        
        return documentation
    
    def _generate_overview(self) -> Dict[str, Any]:
        """Generate API overview."""
        return {
            "description": "RESTful API for accessing the Pixelated Empathy AI dataset and processing system",
            "version": "1.0.0",
            "base_url": "https://api.pixelated-empathy.ai/v1",
            "protocols": ["HTTPS"],
            "data_formats": ["JSON", "JSONL", "CSV", "Parquet"],
            "authentication": "API Key based authentication",
            "rate_limits": "1000 requests per hour for standard users",
            "key_features": [
                "Dataset access and filtering",
                "Quality metrics and validation",
                "Real-time processing capabilities",
                "Multiple export formats",
                "Advanced search and filtering",
                "Comprehensive statistics and analytics"
            ],
            "supported_operations": [
                "GET - Retrieve data and information",
                "POST - Submit processing requests",
                "PUT - Update configurations",
                "DELETE - Remove data (with appropriate permissions)"
            ]
        }
    
    def _generate_authentication(self) -> Dict[str, Any]:
        """Generate authentication documentation."""
        return {
            "method": "API Key Authentication",
            "header": "Authorization: Bearer YOUR_API_KEY",
            "obtaining_key": {
                "registration": "Register at https://api.pixelated-empathy.ai/register",
                "verification": "Email verification required",
                "approval": "Manual approval for research and commercial use",
                "key_generation": "API key generated upon approval"
            },
            "key_management": {
                "rotation": "Keys should be rotated every 90 days",
                "storage": "Store keys securely, never in code repositories",
                "sharing": "Never share API keys with unauthorized users",
                "revocation": "Keys can be revoked immediately if compromised"
            },
            "authentication_example": {
                "curl": "curl -H 'Authorization: Bearer YOUR_API_KEY' https://api.pixelated-empathy.ai/v1/datasets",
                "python": """
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.pixelated-empathy.ai/v1/datasets', headers=headers)
                """.strip(),
                "javascript": """
const headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
};

fetch('https://api.pixelated-empathy.ai/v1/datasets', { headers })
    .then(response => response.json())
    .then(data => console.log(data));
                """.strip()
            }
        }
    
    def _generate_dataset_access_api(self) -> Dict[str, Any]:
        """Generate dataset access API documentation."""
        return {
            "endpoints": {
                "list_datasets": {
                    "method": "GET",
                    "path": "/datasets",
                    "description": "List all available datasets",
                    "parameters": {
                        "tier": "Filter by tier (1, 2, 3)",
                        "quality_min": "Minimum quality score (0.0-1.0)",
                        "limit": "Number of results to return (default: 100)",
                        "offset": "Offset for pagination (default: 0)"
                    },
                    "response": {
                        "datasets": [
                            {
                                "id": "priority_1",
                                "name": "Priority Dataset Tier 1",
                                "description": "High-priority therapeutic conversations",
                                "conversation_count": 102594,
                                "average_quality": 0.637,
                                "tier": 1,
                                "created_at": "2024-08-01T00:00:00Z"
                            }
                        ],
                        "total": 25,
                        "limit": 100,
                        "offset": 0
                    }
                },
                "get_dataset": {
                    "method": "GET",
                    "path": "/datasets/{dataset_id}",
                    "description": "Get detailed information about a specific dataset",
                    "parameters": {
                        "dataset_id": "Unique dataset identifier"
                    },
                    "response": {
                        "id": "priority_1",
                        "name": "Priority Dataset Tier 1",
                        "description": "High-priority therapeutic conversations",
                        "conversation_count": 102594,
                        "average_quality": 0.637,
                        "tier": 1,
                        "metadata": {
                            "source": "Multiple therapeutic conversation sources",
                            "processing_date": "2024-08-01T00:00:00Z",
                            "quality_validation": "Real NLP-based validation"
                        }
                    }
                },
                "get_conversations": {
                    "method": "GET",
                    "path": "/datasets/{dataset_id}/conversations",
                    "description": "Get conversations from a specific dataset",
                    "parameters": {
                        "dataset_id": "Unique dataset identifier",
                        "quality_min": "Minimum quality score",
                        "quality_max": "Maximum quality score",
                        "limit": "Number of conversations to return",
                        "offset": "Offset for pagination",
                        "format": "Response format (json, jsonl, csv)"
                    },
                    "response": {
                        "conversations": [
                            {
                                "id": "conv_12345",
                                "turns": [
                                    {
                                        "speaker": "user",
                                        "text": "I've been feeling really anxious lately..."
                                    },
                                    {
                                        "speaker": "assistant",
                                        "text": "I understand that anxiety can be overwhelming..."
                                    }
                                ],
                                "quality_score": 0.75,
                                "metadata": {
                                    "tier": 1,
                                    "topic": "anxiety",
                                    "length": 8
                                }
                            }
                        ],
                        "total": 102594,
                        "limit": 100,
                        "offset": 0
                    }
                }
            }
        }
    
    def _generate_quality_metrics_api(self) -> Dict[str, Any]:
        """Generate quality metrics API documentation."""
        return {
            "endpoints": {
                "get_quality_metrics": {
                    "method": "GET",
                    "path": "/quality/metrics",
                    "description": "Get overall quality metrics for all datasets",
                    "response": {
                        "overall_metrics": {
                            "average_quality": 0.687,
                            "total_conversations": 2592223,
                            "high_quality_count": 1234567,
                            "quality_distribution": {
                                "0.8-1.0": 456789,
                                "0.6-0.8": 777778,
                                "0.4-0.6": 357656,
                                "0.0-0.4": 0
                            }
                        }
                    }
                },
                "validate_conversation": {
                    "method": "POST",
                    "path": "/quality/validate",
                    "description": "Validate quality of a conversation",
                    "request_body": {
                        "conversation": {
                            "turns": [
                                {
                                    "speaker": "user",
                                    "text": "I'm feeling depressed"
                                },
                                {
                                    "speaker": "assistant", 
                                    "text": "I'm sorry to hear you're feeling this way..."
                                }
                            ]
                        }
                    },
                    "response": {
                        "quality_score": 0.75,
                        "quality_breakdown": {
                            "therapeutic_accuracy": 0.80,
                            "conversation_coherence": 0.85,
                            "emotional_authenticity": 0.70,
                            "clinical_compliance": 0.75,
                            "personality_consistency": 0.65,
                            "language_quality": 0.90
                        },
                        "recommendations": [
                            "Consider more specific therapeutic techniques",
                            "Enhance emotional validation"
                        ]
                    }
                }
            }
        }
    
    def _generate_processing_api(self) -> Dict[str, Any]:
        """Generate processing API documentation."""
        return {
            "endpoints": {
                "submit_processing_job": {
                    "method": "POST",
                    "path": "/processing/jobs",
                    "description": "Submit a new processing job",
                    "request_body": {
                        "job_type": "dataset_processing",
                        "input_data": {
                            "source": "url_or_file_reference",
                            "format": "jsonl"
                        },
                        "processing_options": {
                            "quality_validation": True,
                            "deduplication": True,
                            "tier_assignment": True
                        }
                    },
                    "response": {
                        "job_id": "job_12345",
                        "status": "queued",
                        "estimated_completion": "2024-08-03T15:30:00Z",
                        "created_at": "2024-08-03T14:00:00Z"
                    }
                },
                "get_job_status": {
                    "method": "GET",
                    "path": "/processing/jobs/{job_id}",
                    "description": "Get status of a processing job",
                    "response": {
                        "job_id": "job_12345",
                        "status": "processing",
                        "progress": 0.65,
                        "processed_items": 6500,
                        "total_items": 10000,
                        "estimated_completion": "2024-08-03T15:30:00Z",
                        "results": {
                            "output_dataset_id": "processed_12345",
                            "quality_report": "Available upon completion"
                        }
                    }
                }
            }
        }
    
    def _generate_export_formats_api(self) -> Dict[str, Any]:
        """Generate export formats API documentation."""
        return {
            "supported_formats": {
                "jsonl": {
                    "description": "JSON Lines format for streaming processing",
                    "mime_type": "application/jsonl",
                    "use_cases": ["Model training", "Data processing", "Streaming"]
                },
                "parquet": {
                    "description": "Columnar storage format for analytics",
                    "mime_type": "application/parquet",
                    "use_cases": ["Data analysis", "Big data processing", "Analytics"]
                },
                "csv": {
                    "description": "Comma-separated values for human readability",
                    "mime_type": "text/csv",
                    "use_cases": ["Manual review", "Spreadsheet analysis", "Simple processing"]
                },
                "huggingface": {
                    "description": "HuggingFace datasets format",
                    "mime_type": "application/json",
                    "use_cases": ["HuggingFace model training", "Transformers library"]
                }
            },
            "endpoints": {
                "export_dataset": {
                    "method": "POST",
                    "path": "/export",
                    "description": "Export dataset in specified format",
                    "request_body": {
                        "dataset_ids": ["priority_1", "priority_2"],
                        "format": "jsonl",
                        "filters": {
                            "quality_min": 0.7,
                            "tier": [1, 2]
                        },
                        "split": {
                            "train": 0.7,
                            "validation": 0.15,
                            "test": 0.15
                        }
                    },
                    "response": {
                        "export_id": "export_12345",
                        "status": "processing",
                        "estimated_completion": "2024-08-03T16:00:00Z"
                    }
                },
                "download_export": {
                    "method": "GET",
                    "path": "/export/{export_id}/download",
                    "description": "Download completed export",
                    "response": "Binary file download or redirect to download URL"
                }
            }
        }

    def _generate_search_api(self) -> Dict[str, Any]:
        """Generate search API documentation."""
        return {
            "endpoints": {
                "search_conversations": {
                    "method": "GET",
                    "path": "/search/conversations",
                    "description": "Search conversations using full-text search",
                    "parameters": {
                        "q": "Search query string",
                        "filters": "JSON object with filters",
                        "limit": "Number of results (default: 20)",
                        "offset": "Offset for pagination"
                    },
                    "response": {
                        "results": [
                            {
                                "conversation_id": "conv_12345",
                                "relevance_score": 0.95,
                                "snippet": "...feeling anxious lately...",
                                "metadata": {
                                    "quality_score": 0.75,
                                    "tier": 1,
                                    "dataset": "priority_1"
                                }
                            }
                        ],
                        "total": 1234,
                        "query_time": 0.045
                    }
                }
            }
        }
    
    def _generate_statistics_api(self) -> Dict[str, Any]:
        """Generate statistics API documentation."""
        return {
            "endpoints": {
                "get_statistics": {
                    "method": "GET",
                    "path": "/statistics",
                    "description": "Get comprehensive dataset statistics",
                    "response": {
                        "total_conversations": 2592223,
                        "average_quality": 0.687,
                        "tier_distribution": {
                            "tier_1": 297917,
                            "tier_2": 1234567,
                            "tier_3": 1059739
                        },
                        "quality_distribution": {
                            "high_quality": 1234567,
                            "medium_quality": 777778,
                            "low_quality": 579878
                        }
                    }
                }
            }
        }
    
    def _generate_error_handling(self) -> Dict[str, Any]:
        """Generate error handling documentation."""
        return {
            "error_format": {
                "error": {
                    "code": "ERROR_CODE",
                    "message": "Human readable error message",
                    "details": "Additional error details",
                    "timestamp": "2024-08-03T14:00:00Z"
                }
            },
            "status_codes": {
                "200": "Success",
                "400": "Bad Request - Invalid parameters",
                "401": "Unauthorized - Invalid API key",
                "403": "Forbidden - Insufficient permissions",
                "404": "Not Found - Resource not found",
                "429": "Too Many Requests - Rate limit exceeded",
                "500": "Internal Server Error"
            }
        }
    
    def _generate_rate_limits(self) -> Dict[str, Any]:
        """Generate rate limits documentation."""
        return {
            "limits": {
                "standard": "1000 requests per hour",
                "premium": "10000 requests per hour",
                "enterprise": "Unlimited with fair use"
            },
            "headers": {
                "X-RateLimit-Limit": "Request limit per hour",
                "X-RateLimit-Remaining": "Remaining requests",
                "X-RateLimit-Reset": "Reset time (Unix timestamp)"
            }
        }
    
    def _generate_sdk_examples(self) -> Dict[str, Any]:
        """Generate SDK examples."""
        return {
            "python": {
                "installation": "pip install pixelated-empathy-sdk",
                "example": """
from pixelated_empathy import PixelatedEmpathyClient

client = PixelatedEmpathyClient(api_key="YOUR_API_KEY")

# Get datasets
datasets = client.get_datasets()

# Get conversations
conversations = client.get_conversations(
    dataset_id="priority_1",
    quality_min=0.7,
    limit=100
)

# Validate conversation quality
quality = client.validate_conversation(conversation_data)
                """.strip()
            },
            "javascript": {
                "installation": "npm install pixelated-empathy-sdk",
                "example": """
const PixelatedEmpathy = require('pixelated-empathy-sdk');

const client = new PixelatedEmpathy({
    apiKey: 'YOUR_API_KEY'
});

// Get datasets
const datasets = await client.getDatasets();

// Get conversations
const conversations = await client.getConversations({
    datasetId: 'priority_1',
    qualityMin: 0.7,
    limit: 100
});
                """.strip()
            }
        }
    
    def _format_as_markdown(self, documentation: Dict[str, Any]) -> str:
        """Format documentation as Markdown."""
        
        md_content = f"""# {documentation['title']}

**Version:** {documentation['version']}  
**Generated:** {documentation['generated_at']}  
**Base URL:** {documentation['base_url']}

## Table of Contents

"""
        
        # Generate table of contents
        for section_key, section_data in documentation['sections'].items():
            section_title = section_key.replace('_', ' ').title()
            md_content += f"- [{section_title}](#{section_key})\n"
        
        md_content += "\n---\n\n"
        
        # Generate sections
        for section_key, section_data in documentation['sections'].items():
            section_title = section_key.replace('_', ' ').title()
            md_content += f"## {section_title} {{#{section_key}}}\n\n"
            
            if isinstance(section_data, dict):
                md_content += self._format_dict_as_markdown(section_data, level=3)
            else:
                md_content += f"{section_data}\n\n"
        
        return md_content
    
    def _format_dict_as_markdown(self, data: Dict[str, Any], level: int = 3) -> str:
        """Format dictionary as Markdown."""
        
        md_content = ""
        header_prefix = "#" * level
        
        for key, value in data.items():
            title = key.replace('_', ' ').title()
            md_content += f"{header_prefix} {title}\n\n"
            
            if isinstance(value, dict):
                md_content += self._format_dict_as_markdown(value, level + 1)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        for sub_key, sub_value in item.items():
                            md_content += f"- **{sub_key}**: {sub_value}\n"
                    else:
                        md_content += f"- {item}\n"
                md_content += "\n"
            else:
                # Handle code blocks
                if isinstance(value, str) and ('\n' in value or 'import ' in value or 'const ' in value):
                    md_content += f"```\n{value}\n```\n\n"
                else:
                    md_content += f"{value}\n\n"
        
        return md_content

def main():
    """Main function to generate API documentation."""
    
    logger.info("Starting API documentation generation...")
    
    try:
        generator = APIDocumentationGenerator()
        documentation = generator.generate_api_documentation()
        
        # Save as JSON
        json_path = generator.docs_path / "api_documentation.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(documentation, f, indent=2, ensure_ascii=False)
        
        # Save as Markdown
        md_path = generator.docs_path / "api_documentation.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(generator._format_as_markdown(documentation))
        
        logger.info("✅ API documentation generation completed successfully!")
        logger.info(f"📄 Documentation saved to: {md_path}")
        
        # Print summary
        print("\n" + "="*80)
        print("API DOCUMENTATION GENERATION COMPLETE")
        print("="*80)
        print(f"📄 Documentation saved to: {md_path}")
        print(f"📊 Sections generated: {len(documentation['sections'])}")
        print("🎯 Task 5.5.3.7 COMPLETED: API documentation for dataset access created")
        print("="*80)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error generating API documentation: {str(e)}")
        return False

if __name__ == "__main__":
    main()
