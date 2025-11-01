#!/usr/bin/env python3
"""
Troubleshooting and FAQ Documentation Generator
Task 5.5.3.8: Build troubleshooting and FAQ documentation

This module generates comprehensive troubleshooting guides and FAQ
for the Pixelated Empathy AI dataset and processing system.
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

class TroubleshootingFAQGenerator:
    """Generate comprehensive troubleshooting and FAQ documentation."""
    
    def __init__(self, base_path: str = "/home/vivi/pixelated/ai"):
        self.base_path = Path(base_path)
        self.docs_path = self.base_path / "docs"
        self.docs_path.mkdir(exist_ok=True)
        
    def generate_troubleshooting_faq(self) -> Dict[str, Any]:
        """Generate comprehensive troubleshooting and FAQ documentation."""
        
        documentation = {
            "title": "Pixelated Empathy AI - Troubleshooting Guide and FAQ",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "sections": {
                "quick_start_issues": self._generate_quick_start_issues(),
                "installation_problems": self._generate_installation_problems(),
                "data_processing_issues": self._generate_data_processing_issues(),
                "quality_validation_problems": self._generate_quality_validation_problems(),
                "performance_issues": self._generate_performance_issues(),
                "api_access_problems": self._generate_api_access_problems(),
                "export_format_issues": self._generate_export_format_issues(),
                "database_problems": self._generate_database_problems(),
                "memory_and_resource_issues": self._generate_memory_resource_issues(),
                "frequently_asked_questions": self._generate_faq(),
                "error_codes_reference": self._generate_error_codes(),
                "support_resources": self._generate_support_resources()
            }
        }
        
        return documentation
    
    def _generate_quick_start_issues(self) -> Dict[str, Any]:
        """Generate quick start troubleshooting."""
        return {
            "common_issues": [
                {
                    "issue": "Virtual environment activation fails",
                    "symptoms": ["Command not found", "Permission denied", "Path not found"],
                    "solutions": [
                        "Ensure virtual environment exists: `python -m venv .venv`",
                        "Use correct activation command: `source .venv/bin/activate` (Linux/Mac) or `.venv\\Scripts\\activate` (Windows)",
                        "Check file permissions: `chmod +x .venv/bin/activate`",
                        "Verify Python installation: `python --version`"
                    ],
                    "prevention": "Always create virtual environment before installing dependencies"
                },
                {
                    "issue": "UV command not found",
                    "symptoms": ["uv: command not found", "UV not installed"],
                    "solutions": [
                        "Install UV: `pip install uv`",
                        "Use pip instead: `pip install -r requirements.txt`",
                        "Check PATH environment variable",
                        "Restart terminal after installation"
                    ],
                    "prevention": "Install UV globally or use pip as alternative"
                },
                {
                    "issue": "Dependencies installation fails",
                    "symptoms": ["Package not found", "Version conflicts", "Build errors"],
                    "solutions": [
                        "Update pip: `pip install --upgrade pip`",
                        "Clear pip cache: `pip cache purge`",
                        "Install system dependencies (Ubuntu): `sudo apt-get install python3-dev build-essential`",
                        "Use specific Python version: `python3.8 -m pip install`"
                    ],
                    "prevention": "Use virtual environment and keep dependencies updated"
                }
            ],
            "verification_steps": [
                "Check Python version: `python --version` (should be 3.8+)",
                "Verify virtual environment: `which python` (should point to .venv)",
                "Test imports: `python -c 'import pandas, numpy, sqlite3'`",
                "Run basic test: `python -c 'print(\"Setup successful\")'`"
            ]
        }
    
    def _generate_installation_problems(self) -> Dict[str, Any]:
        """Generate installation troubleshooting."""
        return {
            "system_requirements": {
                "minimum": {
                    "python": "3.8+",
                    "memory": "8GB RAM",
                    "storage": "100GB free space",
                    "cpu": "4 cores"
                },
                "recommended": {
                    "python": "3.9+",
                    "memory": "32GB RAM",
                    "storage": "1TB SSD",
                    "cpu": "16 cores"
                }
            },
            "common_installation_issues": [
                {
                    "issue": "spaCy model download fails",
                    "symptoms": ["Model not found", "Download timeout", "SSL errors"],
                    "solutions": [
                        "Download manually: `python -m spacy download en_core_web_sm`",
                        "Use alternative model: `python -m spacy download en_core_web_md`",
                        "Check internet connection and proxy settings",
                        "Install from local file if available"
                    ]
                },
                {
                    "issue": "PyTorch installation issues",
                    "symptoms": ["CUDA version mismatch", "No GPU support", "Import errors"],
                    "solutions": [
                        "Install CPU version: `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu`",
                        "Check CUDA version: `nvidia-smi`",
                        "Install matching CUDA version from PyTorch website",
                        "Use conda for complex dependencies: `conda install pytorch`"
                    ]
                },
                {
                    "issue": "Database setup fails",
                    "symptoms": ["SQLite errors", "Permission denied", "Database locked"],
                    "solutions": [
                        "Check file permissions: `chmod 664 database/conversations.db`",
                        "Ensure directory exists: `mkdir -p database`",
                        "Close all database connections",
                        "Delete and recreate database if corrupted"
                    ]
                }
            ]
        }
    
    def _generate_data_processing_issues(self) -> Dict[str, Any]:
        """Generate data processing troubleshooting."""
        return {
            "processing_failures": [
                {
                    "issue": "Dataset processing stops unexpectedly",
                    "symptoms": ["Process terminates", "Incomplete results", "Error messages"],
                    "solutions": [
                        "Check available memory: `free -h`",
                        "Monitor disk space: `df -h`",
                        "Review error logs in logs/ directory",
                        "Reduce batch size in processing configuration",
                        "Use streaming processing for large files"
                    ],
                    "debugging": [
                        "Enable debug logging: `export LOG_LEVEL=DEBUG`",
                        "Process smaller sample first",
                        "Check file integrity: `file dataset.jsonl`",
                        "Validate JSON format: `python -m json.tool < file.json`"
                    ]
                },
                {
                    "issue": "Quality validation takes too long",
                    "symptoms": ["Slow processing", "High CPU usage", "Timeout errors"],
                    "solutions": [
                        "Reduce quality validation complexity",
                        "Use parallel processing: increase worker count",
                        "Cache validation results",
                        "Skip validation for testing: set `skip_validation=True`"
                    ]
                },
                {
                    "issue": "File format not recognized",
                    "symptoms": ["Format detection fails", "Parsing errors", "Empty results"],
                    "solutions": [
                        "Check file extension and content",
                        "Verify file encoding: `file -i dataset.txt`",
                        "Convert to supported format (JSONL, JSON, CSV)",
                        "Check for BOM or special characters"
                    ]
                }
            ],
            "data_quality_issues": [
                {
                    "issue": "Low quality scores across dataset",
                    "symptoms": ["All conversations below threshold", "Quality validation fails"],
                    "solutions": [
                        "Review quality thresholds in configuration",
                        "Check if quality validation is working correctly",
                        "Examine sample conversations manually",
                        "Adjust quality weights for your use case"
                    ]
                },
                {
                    "issue": "Deduplication removes too many conversations",
                    "symptoms": ["Significant reduction in dataset size", "Similar conversations removed"],
                    "solutions": [
                        "Adjust similarity threshold (default: 0.85)",
                        "Review deduplication algorithm settings",
                        "Check if conversations are actually duplicates",
                        "Disable deduplication for testing: `enable_deduplication=False`"
                    ]
                }
            ]
        }
    
    def _generate_quality_validation_problems(self) -> Dict[str, Any]:
        """Generate quality validation troubleshooting."""
        return {
            "validation_errors": [
                {
                    "issue": "Quality validation fails to start",
                    "symptoms": ["Import errors", "Model loading fails", "Configuration errors"],
                    "solutions": [
                        "Install required models: `python -m spacy download en_core_web_sm`",
                        "Check transformers installation: `pip install transformers`",
                        "Verify configuration file format",
                        "Test with minimal configuration"
                    ]
                },
                {
                    "issue": "Inconsistent quality scores",
                    "symptoms": ["Scores vary between runs", "Unexpected quality ratings"],
                    "solutions": [
                        "Set random seed for reproducibility",
                        "Check for non-deterministic operations",
                        "Verify input data consistency",
                        "Review quality metric weights"
                    ]
                }
            ],
            "performance_optimization": [
                {
                    "technique": "Batch processing",
                    "description": "Process conversations in batches to improve efficiency",
                    "implementation": "Set batch_size=1000 in configuration"
                },
                {
                    "technique": "Caching",
                    "description": "Cache quality validation results",
                    "implementation": "Enable caching: `enable_cache=True`"
                },
                {
                    "technique": "Parallel processing",
                    "description": "Use multiple workers for validation",
                    "implementation": "Set num_workers=4 (adjust based on CPU cores)"
                }
            ]
        }
    
    def _generate_performance_issues(self) -> Dict[str, Any]:
        """Generate performance troubleshooting."""
        return {
            "memory_issues": [
                {
                    "issue": "Out of memory errors",
                    "symptoms": ["MemoryError", "System becomes unresponsive", "Process killed"],
                    "solutions": [
                        "Reduce batch size: `batch_size=500`",
                        "Use streaming processing",
                        "Close unused applications",
                        "Add swap space: `sudo swapon /swapfile`",
                        "Process datasets separately"
                    ],
                    "monitoring": [
                        "Monitor memory usage: `htop` or `top`",
                        "Check memory per process: `ps aux --sort=-%mem`",
                        "Use memory profiler: `pip install memory-profiler`"
                    ]
                }
            ],
            "cpu_optimization": [
                {
                    "technique": "Parallel processing",
                    "description": "Utilize multiple CPU cores",
                    "configuration": "Set num_workers to number of CPU cores - 1"
                },
                {
                    "technique": "Process prioritization",
                    "description": "Adjust process priority",
                    "command": "nice -n 10 python processing_script.py"
                }
            ],
            "disk_io_optimization": [
                {
                    "technique": "SSD usage",
                    "description": "Use SSD for data processing",
                    "benefit": "10-100x faster than HDD"
                },
                {
                    "technique": "Batch writes",
                    "description": "Write data in batches",
                    "configuration": "Set write_batch_size=10000"
                }
            ]
        }
    
    def _generate_api_access_problems(self) -> Dict[str, Any]:
        """Generate API access troubleshooting."""
        return {
            "authentication_issues": [
                {
                    "issue": "API key not working",
                    "symptoms": ["401 Unauthorized", "Invalid API key"],
                    "solutions": [
                        "Verify API key format and validity",
                        "Check for extra spaces or characters",
                        "Regenerate API key if necessary",
                        "Ensure proper header format: `Authorization: Bearer YOUR_KEY`"
                    ]
                },
                {
                    "issue": "Rate limit exceeded",
                    "symptoms": ["429 Too Many Requests", "Rate limit headers"],
                    "solutions": [
                        "Implement exponential backoff",
                        "Reduce request frequency",
                        "Upgrade to higher tier plan",
                        "Cache responses to reduce requests"
                    ]
                }
            ],
            "connection_issues": [
                {
                    "issue": "Connection timeout",
                    "symptoms": ["Timeout errors", "Connection refused"],
                    "solutions": [
                        "Check internet connection",
                        "Verify API endpoint URL",
                        "Increase timeout values",
                        "Check firewall settings"
                    ]
                }
            ]
        }
    
    def _generate_export_format_issues(self) -> Dict[str, Any]:
        """Generate export format troubleshooting."""
        return {
            "format_specific_issues": {
                "jsonl": [
                    {
                        "issue": "Invalid JSON in JSONL file",
                        "solutions": ["Validate each line separately", "Check for unescaped quotes", "Verify UTF-8 encoding"]
                    }
                ],
                "parquet": [
                    {
                        "issue": "Schema mismatch errors",
                        "solutions": ["Ensure consistent data types", "Handle null values", "Use schema evolution"]
                    }
                ],
                "csv": [
                    {
                        "issue": "Encoding issues with special characters",
                        "solutions": ["Use UTF-8 encoding", "Escape special characters", "Use proper CSV quoting"]
                    }
                ]
            }
        }
    
    def _generate_database_problems(self) -> Dict[str, Any]:
        """Generate database troubleshooting."""
        return {
            "common_database_issues": [
                {
                    "issue": "Database locked error",
                    "symptoms": ["SQLite database is locked", "Cannot write to database"],
                    "solutions": [
                        "Close all database connections",
                        "Check for zombie processes: `ps aux | grep python`",
                        "Restart application",
                        "Use WAL mode: `PRAGMA journal_mode=WAL`"
                    ]
                },
                {
                    "issue": "Database corruption",
                    "symptoms": ["Database disk image is malformed", "Integrity check fails"],
                    "solutions": [
                        "Run integrity check: `PRAGMA integrity_check`",
                        "Backup and restore database",
                        "Recreate database from processed data",
                        "Check disk space and file system"
                    ]
                }
            ]
        }
    
    def _generate_memory_resource_issues(self) -> Dict[str, Any]:
        """Generate memory and resource troubleshooting."""
        return {
            "resource_monitoring": {
                "memory": [
                    "Monitor with htop: `htop`",
                    "Check memory per process: `ps aux --sort=-%mem | head -10`",
                    "Monitor Python memory: `pip install psutil`"
                ],
                "disk": [
                    "Check disk usage: `df -h`",
                    "Find large files: `du -h --max-depth=1 | sort -hr`",
                    "Monitor I/O: `iotop`"
                ],
                "cpu": [
                    "Monitor CPU usage: `top`",
                    "Check load average: `uptime`",
                    "Profile Python code: `pip install py-spy`"
                ]
            }
        }
    
    def _generate_faq(self) -> Dict[str, Any]:
        """Generate frequently asked questions."""
        return {
            "general_questions": [
                {
                    "question": "What is the minimum system requirement?",
                    "answer": "Python 3.8+, 8GB RAM, 100GB storage, and 4 CPU cores. For optimal performance, we recommend 32GB RAM and SSD storage."
                },
                {
                    "question": "How long does dataset processing take?",
                    "answer": "Processing time varies by dataset size and system specs. Expect 1-2 hours for 100K conversations on recommended hardware."
                },
                {
                    "question": "Can I use this for commercial purposes?",
                    "answer": "The dataset requires a commercial license for commercial use. The software is MIT licensed and can be used commercially."
                },
                {
                    "question": "How accurate are the quality scores?",
                    "answer": "Quality scores are based on real NLP analysis with >95% accuracy. They should be used as guidance, not absolute truth."
                }
            ],
            "technical_questions": [
                {
                    "question": "Why are some datasets returning 0 conversations?",
                    "answer": "This usually indicates file format issues, corruption, or processing errors. Check logs and verify file integrity."
                },
                {
                    "question": "How can I improve processing speed?",
                    "answer": "Use SSD storage, increase batch size, enable parallel processing, and ensure adequate RAM."
                },
                {
                    "question": "What export formats are supported?",
                    "answer": "JSONL, Parquet, CSV, HuggingFace datasets, OpenAI format, PyTorch, and TensorFlow formats."
                }
            ],
            "usage_questions": [
                {
                    "question": "How do I choose quality thresholds?",
                    "answer": "Use 0.6+ for general use, 0.7+ for training, 0.8+ for production. Adjust based on your specific requirements."
                },
                {
                    "question": "Can I add my own datasets?",
                    "answer": "Yes, the system supports custom datasets in JSONL, JSON, or CSV format with proper conversation structure."
                }
            ]
        }
    
    def _generate_error_codes(self) -> Dict[str, Any]:
        """Generate error codes reference."""
        return {
            "processing_errors": {
                "PE001": "File format not recognized",
                "PE002": "Invalid conversation structure",
                "PE003": "Quality validation failed",
                "PE004": "Insufficient memory",
                "PE005": "Database connection failed"
            },
            "api_errors": {
                "API001": "Invalid API key",
                "API002": "Rate limit exceeded",
                "API003": "Resource not found",
                "API004": "Invalid request format",
                "API005": "Server error"
            },
            "export_errors": {
                "EX001": "Export format not supported",
                "EX002": "Export generation failed",
                "EX003": "File write permission denied",
                "EX004": "Insufficient disk space"
            }
        }
    
    def _generate_support_resources(self) -> Dict[str, Any]:
        """Generate support resources."""
        return {
            "documentation": [
                "README.md - Quick start guide",
                "docs/usage_guidelines.md - Comprehensive usage guide",
                "docs/api_documentation.md - API reference",
                "docs/licensing_ethical_guidelines.md - Legal and ethical guidelines"
            ],
            "community_support": [
                "GitHub Issues - Bug reports and feature requests",
                "GitHub Discussions - Community Q&A",
                "Documentation Wiki - Community-contributed guides"
            ],
            "professional_support": [
                "Enterprise support available for commercial users",
                "Consulting services for custom implementations",
                "Training and workshops available"
            ],
            "contact_information": {
                "general_inquiries": "info@pixelated-empathy.ai",
                "technical_support": "support@pixelated-empathy.ai",
                "commercial_licensing": "licensing@pixelated-empathy.ai",
                "security_issues": "security@pixelated-empathy.ai"
            }
        }
    
    def save_troubleshooting_faq(self, documentation: Dict[str, Any]) -> str:
        """Save troubleshooting and FAQ documentation to files."""
        
        # Save as JSON
        json_path = self.docs_path / "troubleshooting_faq.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(documentation, f, indent=2, ensure_ascii=False)
        
        # Save as Markdown
        md_path = self.docs_path / "troubleshooting_faq.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(self._format_as_markdown(documentation))
        
        logger.info(f"Troubleshooting and FAQ documentation saved to {json_path} and {md_path}")
        return str(md_path)
    
    def _format_as_markdown(self, documentation: Dict[str, Any]) -> str:
        """Format documentation as Markdown."""
        
        md_content = f"""# {documentation['title']}

**Version:** {documentation['version']}  
**Generated:** {documentation['generated_at']}

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
                        # Handle structured items like issues with solutions
                        if 'issue' in item:
                            md_content += f"**Issue:** {item['issue']}\n\n"
                            if 'symptoms' in item:
                                md_content += "**Symptoms:**\n"
                                for symptom in item['symptoms']:
                                    md_content += f"- {symptom}\n"
                                md_content += "\n"
                            if 'solutions' in item:
                                md_content += "**Solutions:**\n"
                                for solution in item['solutions']:
                                    md_content += f"- {solution}\n"
                                md_content += "\n"
                        elif 'question' in item:
                            md_content += f"**Q:** {item['question']}\n\n"
                            md_content += f"**A:** {item['answer']}\n\n"
                        else:
                            for sub_key, sub_value in item.items():
                                md_content += f"- **{sub_key}**: {sub_value}\n"
                    else:
                        md_content += f"- {item}\n"
                md_content += "\n"
            else:
                md_content += f"{value}\n\n"
        
        return md_content

def main():
    """Main function to generate troubleshooting and FAQ documentation."""
    
    logger.info("Starting troubleshooting and FAQ documentation generation...")
    
    try:
        generator = TroubleshootingFAQGenerator()
        documentation = generator.generate_troubleshooting_faq()
        output_path = generator.save_troubleshooting_faq(documentation)
        
        logger.info("✅ Troubleshooting and FAQ documentation generation completed successfully!")
        logger.info(f"📄 Documentation saved to: {output_path}")
        
        # Print summary
        print("\n" + "="*80)
        print("TROUBLESHOOTING AND FAQ DOCUMENTATION GENERATION COMPLETE")
        print("="*80)
        print(f"📄 Documentation saved to: {output_path}")
        print(f"📊 Sections generated: {len(documentation['sections'])}")
        print("🎯 Task 5.5.3.8 COMPLETED: Troubleshooting and FAQ documentation created")
        print("="*80)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error generating troubleshooting and FAQ documentation: {str(e)}")
        return False

if __name__ == "__main__":
    main()
