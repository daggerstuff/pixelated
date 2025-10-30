#!/usr/bin/env python3
"""
Deployment and Integration Guides Generator
Task 5.5.3.10: Create deployment and integration guides

This module generates comprehensive deployment and integration guides
for the Pixelated Empathy AI dataset and system.
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

class DeploymentIntegrationGuidesGenerator:
    """Generate comprehensive deployment and integration guides."""
    
    def __init__(self, base_path: str = "/home/vivi/pixelated/ai"):
        self.base_path = Path(base_path)
        self.docs_path = self.base_path / "docs"
        self.docs_path.mkdir(exist_ok=True)
        
    def generate_deployment_guides(self) -> Dict[str, Any]:
        """Generate comprehensive deployment and integration guides."""
        
        guides = {
            "title": "Pixelated Empathy AI - Deployment and Integration Guides",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "sections": {
                "quick_start_deployment": self._generate_quick_start(),
                "local_development_setup": self._generate_local_setup(),
                "production_deployment": self._generate_production_deployment(),
                "cloud_deployment": self._generate_cloud_deployment(),
                "containerization": self._generate_containerization(),
                "api_integration": self._generate_api_integration(),
                "database_integration": self._generate_database_integration(),
                "monitoring_setup": self._generate_monitoring_setup(),
                "security_configuration": self._generate_security_config(),
                "performance_tuning": self._generate_performance_tuning(),
                "backup_recovery": self._generate_backup_recovery(),
                "troubleshooting_deployment": self._generate_deployment_troubleshooting()
            }
        }
        
        return guides
    
    def _generate_quick_start(self) -> Dict[str, Any]:
        """Generate quick start deployment guide."""
        return {
            "overview": "Get Pixelated Empathy AI running in under 10 minutes",
            "prerequisites": [
                "Python 3.8+ installed",
                "Git installed",
                "8GB+ RAM available",
                "100GB+ free disk space"
            ],
            "steps": [
                {
                    "step": 1,
                    "title": "Clone Repository",
                    "description": "Clone the Pixelated Empathy AI repository",
                    "commands": [
                        "git clone https://github.com/pixelated-empathy/ai.git",
                        "cd ai"
                    ]
                },
                {
                    "step": 2,
                    "title": "Setup Environment",
                    "description": "Create virtual environment and install dependencies",
                    "commands": [
                        "python -m venv .venv",
                        "source .venv/bin/activate  # Linux/Mac",
                        "# .venv\\Scripts\\activate  # Windows",
                        "pip install uv",
                        "uv sync"
                    ]
                },
                {
                    "step": 3,
                    "title": "Initialize Database",
                    "description": "Set up the conversation database",
                    "commands": [
                        "python database/conversation_database.py"
                    ]
                },
                {
                    "step": 4,
                    "title": "Run Basic Processing",
                    "description": "Test the system with sample data",
                    "commands": [
                        "python production_deployment/production_orchestrator.py --sample"
                    ]
                },
                {
                    "step": 5,
                    "title": "Verify Installation",
                    "description": "Run tests to verify everything works",
                    "commands": [
                        "python -m pytest tests/ -v"
                    ]
                }
            ],
            "verification": [
                "Check that database was created: `ls database/conversations.db`",
                "Verify sample processing completed successfully",
                "Confirm all tests pass",
                "Access documentation at `docs/README.md`"
            ],
            "next_steps": [
                "Review usage guidelines in docs/usage_guidelines.md",
                "Configure for your specific use case",
                "Set up production deployment if needed",
                "Integrate with your existing systems"
            ]
        }
    
    def _generate_local_setup(self) -> Dict[str, Any]:
        """Generate local development setup guide."""
        return {
            "development_environment": {
                "recommended_setup": {
                    "os": "Ubuntu 20.04+ or macOS 10.15+",
                    "python": "3.9+",
                    "memory": "16GB+ RAM",
                    "storage": "500GB+ SSD",
                    "editor": "VS Code with Python extension"
                },
                "required_tools": [
                    "Git for version control",
                    "Python 3.8+ with pip",
                    "UV for dependency management",
                    "Docker (optional, for containerization)",
                    "SQLite browser for database inspection"
                ]
            },
            "setup_steps": [
                {
                    "category": "Environment Setup",
                    "steps": [
                        "Install Python 3.9+: `sudo apt install python3.9 python3.9-venv`",
                        "Install Git: `sudo apt install git`",
                        "Install UV: `pip install uv`",
                        "Clone repository: `git clone [repository-url]`"
                    ]
                },
                {
                    "category": "Dependencies",
                    "steps": [
                        "Create virtual environment: `python -m venv .venv`",
                        "Activate environment: `source .venv/bin/activate`",
                        "Install dependencies: `uv sync`",
                        "Install development tools: `uv add --dev pytest black ruff`"
                    ]
                },
                {
                    "category": "Configuration",
                    "steps": [
                        "Copy example config: `cp config/example.json config/local.json`",
                        "Edit configuration for local development",
                        "Set environment variables: `export PIXELATED_ENV=development`",
                        "Initialize database: `python database/conversation_database.py`"
                    ]
                }
            ],
            "development_workflow": {
                "daily_workflow": [
                    "Activate virtual environment",
                    "Pull latest changes: `git pull`",
                    "Update dependencies: `uv sync`",
                    "Run tests: `python -m pytest`",
                    "Start development server or processing"
                ],
                "code_quality": [
                    "Format code: `black .`",
                    "Lint code: `ruff check .`",
                    "Type checking: `mypy .`",
                    "Run tests: `pytest --cov=.`"
                ]
            }
        }
    
    def _generate_production_deployment(self) -> Dict[str, Any]:
        """Generate production deployment guide."""
        return {
            "production_requirements": {
                "hardware": {
                    "minimum": {
                        "cpu": "8 cores",
                        "memory": "32GB RAM",
                        "storage": "1TB SSD",
                        "network": "1Gbps"
                    },
                    "recommended": {
                        "cpu": "16+ cores",
                        "memory": "64GB+ RAM",
                        "storage": "2TB+ NVMe SSD",
                        "network": "10Gbps"
                    }
                },
                "software": {
                    "os": "Ubuntu 20.04 LTS or CentOS 8+",
                    "python": "3.9+",
                    "database": "SQLite 3.35+ (PostgreSQL for enterprise)",
                    "monitoring": "Prometheus + Grafana",
                    "logging": "ELK Stack or similar"
                }
            },
            "deployment_steps": [
                {
                    "phase": "Pre-deployment",
                    "tasks": [
                        "Provision production servers",
                        "Set up monitoring and logging",
                        "Configure security (firewall, SSL)",
                        "Prepare deployment scripts",
                        "Set up backup systems"
                    ]
                },
                {
                    "phase": "Application Deployment",
                    "tasks": [
                        "Deploy application code",
                        "Install and configure dependencies",
                        "Set up production configuration",
                        "Initialize production database",
                        "Configure environment variables"
                    ]
                },
                {
                    "phase": "Service Configuration",
                    "tasks": [
                        "Configure systemd services",
                        "Set up reverse proxy (nginx)",
                        "Configure SSL certificates",
                        "Set up log rotation",
                        "Configure monitoring agents"
                    ]
                },
                {
                    "phase": "Testing and Validation",
                    "tasks": [
                        "Run smoke tests",
                        "Validate API endpoints",
                        "Test processing pipeline",
                        "Verify monitoring and alerting",
                        "Perform load testing"
                    ]
                }
            ],
            "production_checklist": [
                "✓ All dependencies installed and configured",
                "✓ Database initialized and accessible",
                "✓ Configuration files properly set",
                "✓ SSL certificates installed and valid",
                "✓ Monitoring and alerting configured",
                "✓ Backup systems operational",
                "✓ Security hardening applied",
                "✓ Performance tuning completed",
                "✓ Documentation updated",
                "✓ Team trained on operations"
            ]
        }
    
    def _generate_cloud_deployment(self) -> Dict[str, Any]:
        """Generate cloud deployment guide."""
        return {
            "aws_deployment": {
                "architecture": {
                    "compute": "EC2 instances with Auto Scaling",
                    "storage": "EBS volumes with snapshots",
                    "database": "RDS PostgreSQL or DynamoDB",
                    "load_balancer": "Application Load Balancer",
                    "monitoring": "CloudWatch + X-Ray"
                },
                "deployment_steps": [
                    "Set up VPC and security groups",
                    "Launch EC2 instances with AMI",
                    "Configure RDS database",
                    "Set up Application Load Balancer",
                    "Configure Auto Scaling groups",
                    "Set up CloudWatch monitoring",
                    "Configure backup and disaster recovery"
                ]
            },
            "azure_deployment": {
                "architecture": {
                    "compute": "Virtual Machines or Container Instances",
                    "storage": "Azure Blob Storage",
                    "database": "Azure Database for PostgreSQL",
                    "load_balancer": "Azure Load Balancer",
                    "monitoring": "Azure Monitor"
                }
            },
            "gcp_deployment": {
                "architecture": {
                    "compute": "Compute Engine or Cloud Run",
                    "storage": "Cloud Storage",
                    "database": "Cloud SQL PostgreSQL",
                    "load_balancer": "Cloud Load Balancing",
                    "monitoring": "Cloud Monitoring"
                }
            }
        }
    
    def _generate_containerization(self) -> Dict[str, Any]:
        """Generate containerization guide."""
        return {
            "docker_setup": {
                "dockerfile": """
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Install UV
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 pixelated
USER pixelated

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "production_deployment/production_orchestrator.py"]
                """.strip(),
                "docker_compose": """
version: '3.8'

services:
  pixelated-ai:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PIXELATED_ENV=production
      - DATABASE_URL=sqlite:///data/conversations.db
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - database
    restart: unless-stopped

  database:
    image: postgres:13
    environment:
      - POSTGRES_DB=pixelated_empathy
      - POSTGRES_USER=pixelated
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  monitoring:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

volumes:
  postgres_data:
                """.strip()
            },
            "kubernetes_deployment": {
                "deployment_yaml": """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixelated-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pixelated-ai
  template:
    metadata:
      labels:
        app: pixelated-ai
    spec:
      containers:
      - name: pixelated-ai
        image: pixelated-empathy/ai:latest
        ports:
        - containerPort: 8000
        env:
        - name: PIXELATED_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
                """.strip()
            }
        }

    def _generate_api_integration(self) -> Dict[str, Any]:
        """Generate API integration guide."""
        return {
            "integration_overview": "How to integrate with Pixelated Empathy AI API",
            "authentication_setup": {
                "api_key_generation": [
                    "Register at API portal",
                    "Verify email address",
                    "Request API access",
                    "Generate API key"
                ],
                "authentication_example": """
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.pixelated-empathy.ai/v1/datasets', headers=headers)
                """.strip()
            },
            "common_integration_patterns": {
                "batch_processing": "Process large datasets in batches",
                "real_time_validation": "Validate conversations in real-time",
                "webhook_integration": "Receive notifications via webhooks",
                "streaming_processing": "Process data streams continuously"
            }
        }
    
    def _generate_database_integration(self) -> Dict[str, Any]:
        """Generate database integration guide."""
        return {
            "supported_databases": {
                "sqlite": {
                    "use_case": "Development and small deployments",
                    "configuration": "DATABASE_URL=sqlite:///data/conversations.db",
                    "pros": ["Simple setup", "No server required", "Good performance for small datasets"],
                    "cons": ["Limited concurrency", "No network access", "Size limitations"]
                },
                "postgresql": {
                    "use_case": "Production deployments",
                    "configuration": "DATABASE_URL=postgresql://user:pass@host:5432/dbname",
                    "pros": ["High concurrency", "Advanced features", "Excellent performance"],
                    "cons": ["Requires server setup", "More complex configuration"]
                }
            },
            "migration_guide": {
                "sqlite_to_postgresql": [
                    "Export data from SQLite",
                    "Set up PostgreSQL server",
                    "Create database schema",
                    "Import data to PostgreSQL",
                    "Update configuration",
                    "Test and validate"
                ]
            }
        }
    
    def _generate_monitoring_setup(self) -> Dict[str, Any]:
        """Generate monitoring setup guide."""
        return {
            "monitoring_stack": {
                "metrics": "Prometheus for metrics collection",
                "visualization": "Grafana for dashboards",
                "logging": "ELK Stack for log aggregation",
                "alerting": "AlertManager for notifications",
                "tracing": "Jaeger for distributed tracing"
            },
            "key_metrics": [
                "Processing throughput (conversations/second)",
                "Quality validation accuracy",
                "API response times",
                "Database query performance",
                "Memory and CPU usage",
                "Error rates and types"
            ],
            "alerting_rules": [
                "High error rate (>5%)",
                "Slow processing (<100 conv/sec)",
                "High memory usage (>80%)",
                "Database connection failures",
                "API endpoint downtime"
            ]
        }
    
    def _generate_security_config(self) -> Dict[str, Any]:
        """Generate security configuration guide."""
        return {
            "security_checklist": [
                "Enable HTTPS with valid SSL certificates",
                "Implement API key authentication",
                "Set up firewall rules",
                "Enable database encryption",
                "Configure secure headers",
                "Implement rate limiting",
                "Set up audit logging",
                "Regular security updates"
            ],
            "ssl_configuration": {
                "certificate_sources": ["Let's Encrypt", "Commercial CA", "Internal CA"],
                "nginx_config": """
server {
    listen 443 ssl http2;
    server_name api.pixelated-empathy.ai;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
                """.strip()
            }
        }
    
    def _generate_performance_tuning(self) -> Dict[str, Any]:
        """Generate performance tuning guide."""
        return {
            "optimization_areas": {
                "database": [
                    "Add appropriate indexes",
                    "Optimize query patterns",
                    "Configure connection pooling",
                    "Enable query caching"
                ],
                "application": [
                    "Optimize batch sizes",
                    "Enable parallel processing",
                    "Implement caching",
                    "Profile and optimize bottlenecks"
                ],
                "system": [
                    "Tune OS parameters",
                    "Optimize memory allocation",
                    "Configure CPU affinity",
                    "Optimize I/O settings"
                ]
            },
            "performance_benchmarks": {
                "processing_speed": "Target: 1,500+ conversations/second",
                "api_response_time": "Target: <200ms for simple queries",
                "database_query_time": "Target: <50ms for indexed queries",
                "memory_usage": "Target: <80% of available RAM"
            }
        }
    
    def _generate_backup_recovery(self) -> Dict[str, Any]:
        """Generate backup and recovery guide."""
        return {
            "backup_strategy": {
                "database_backups": {
                    "frequency": "Daily full backups, hourly incrementals",
                    "retention": "30 days local, 1 year offsite",
                    "automation": "Automated with monitoring and alerts"
                },
                "application_backups": {
                    "configuration": "Version controlled configuration files",
                    "processed_data": "Regular snapshots of processed datasets",
                    "logs": "Archived logs for audit and debugging"
                }
            },
            "disaster_recovery": {
                "rto": "Recovery Time Objective: 4 hours",
                "rpo": "Recovery Point Objective: 1 hour",
                "procedures": [
                    "Assess damage and determine recovery approach",
                    "Restore from most recent backup",
                    "Validate data integrity",
                    "Resume operations and monitor"
                ]
            }
        }
    
    def _generate_deployment_troubleshooting(self) -> Dict[str, Any]:
        """Generate deployment troubleshooting guide."""
        return {
            "common_deployment_issues": [
                {
                    "issue": "Service fails to start",
                    "symptoms": ["Service startup errors", "Port binding failures"],
                    "solutions": [
                        "Check configuration files",
                        "Verify port availability",
                        "Check file permissions",
                        "Review system logs"
                    ]
                },
                {
                    "issue": "Database connection failures",
                    "symptoms": ["Connection timeout", "Authentication errors"],
                    "solutions": [
                        "Verify database server is running",
                        "Check connection string",
                        "Validate credentials",
                        "Test network connectivity"
                    ]
                },
                {
                    "issue": "High memory usage",
                    "symptoms": ["Out of memory errors", "System slowdown"],
                    "solutions": [
                        "Reduce batch sizes",
                        "Enable memory monitoring",
                        "Optimize processing algorithms",
                        "Add more RAM or swap"
                    ]
                }
            ],
            "diagnostic_commands": [
                "Check service status: `systemctl status pixelated-ai`",
                "View logs: `journalctl -u pixelated-ai -f`",
                "Monitor resources: `htop` or `top`",
                "Test connectivity: `curl -I http://localhost:8000/health`",
                "Check disk space: `df -h`"
            ]
        }
    
    def _format_as_markdown(self, guides: Dict[str, Any]) -> str:
        """Format guides as Markdown."""
        
        md_content = f"""# {guides['title']}

**Version:** {guides['version']}  
**Generated:** {guides['generated_at']}

## Table of Contents

"""
        
        # Generate table of contents
        for section_key, section_data in guides['sections'].items():
            section_title = section_key.replace('_', ' ').title()
            md_content += f"- [{section_title}](#{section_key})\n"
        
        md_content += "\n---\n\n"
        
        # Generate sections
        for section_key, section_data in guides['sections'].items():
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
                        # Handle structured items
                        for sub_key, sub_value in item.items():
                            if isinstance(sub_value, list):
                                md_content += f"**{sub_key.replace('_', ' ').title()}:**\n"
                                for sub_item in sub_value:
                                    md_content += f"- {sub_item}\n"
                                md_content += "\n"
                            else:
                                md_content += f"- **{sub_key.replace('_', ' ').title()}**: {sub_value}\n"
                        md_content += "\n"
                    else:
                        md_content += f"- {item}\n"
                md_content += "\n"
            else:
                # Handle code blocks
                if isinstance(value, str) and ('\n' in value or 'import ' in value or 'FROM ' in value):
                    md_content += f"```\n{value}\n```\n\n"
                else:
                    md_content += f"{value}\n\n"
        
        return md_content

def main():
    """Main function to generate deployment and integration guides."""
    
    logger.info("Starting deployment and integration guides generation...")
    
    try:
        generator = DeploymentIntegrationGuidesGenerator()
        guides = generator.generate_deployment_guides()
        
        # Save as JSON
        json_path = generator.docs_path / "deployment_integration_guides.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(guides, f, indent=2, ensure_ascii=False)
        
        # Save as Markdown
        md_path = generator.docs_path / "deployment_integration_guides.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(generator._format_as_markdown(guides))
        
        logger.info("✅ Deployment and integration guides generation completed successfully!")
        logger.info(f"📄 Guides saved to: {md_path}")
        
        # Print summary
        print("\n" + "="*80)
        print("DEPLOYMENT AND INTEGRATION GUIDES GENERATION COMPLETE")
        print("="*80)
        print(f"📄 Guides saved to: {md_path}")
        print(f"📊 Sections generated: {len(guides['sections'])}")
        print("🎯 Task 5.5.3.10 COMPLETED: Deployment and integration guides created")
        print("="*80)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error generating deployment and integration guides: {str(e)}")
        return False

if __name__ == "__main__":
    main()
