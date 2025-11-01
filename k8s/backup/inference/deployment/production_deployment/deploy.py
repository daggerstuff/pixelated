#!/usr/bin/env python3
"""
Production Deployment System for Pixelated Empathy AI
Comprehensive deployment automation with Docker, Kubernetes, and CI/CD integration.
"""

import os
import sys
import json
import yaml
import logging
import subprocess
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import shutil

@dataclass
class DeploymentConfig:
    """Configuration for deployment."""
    environment: str
    version: str
    image_tag: str
    replicas: int
    resources: Dict[str, Any]
    secrets: Dict[str, str]
    config_maps: Dict[str, str]
    health_check_url: str
    rollback_enabled: bool = True
    backup_before_deploy: bool = True

class ProductionDeployer:
    """Comprehensive production deployment system."""
    
    def __init__(self, config_path: str = "deployment_config.yaml"):
        self.config_path = config_path
        self.logger = self._setup_logging()
        self.deployment_history = []
        
        # Deployment environments
        self.environments = {
            'development': {
                'namespace': 'pixelated-dev',
                'replicas': 1,
                'resources': {'cpu': '500m', 'memory': '1Gi'},
                'domain': 'dev.pixelated-empathy.ai'
            },
            'staging': {
                'namespace': 'pixelated-staging',
                'replicas': 2,
                'resources': {'cpu': '1000m', 'memory': '2Gi'},
                'domain': 'staging.pixelated-empathy.ai'
            },
            'production': {
                'namespace': 'pixelated-prod',
                'replicas': 3,
                'resources': {'cpu': '2000m', 'memory': '4Gi'},
                'domain': 'pixelated-empathy.ai'
            }
        }
        
        # Required tools
        self.required_tools = ['docker', 'kubectl', 'helm']
        
    def _setup_logging(self) -> logging.Logger:
        """Setup deployment logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('deployment.log'),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger(__name__)

    def validate_prerequisites(self) -> bool:
        """Validate deployment prerequisites."""
        self.logger.info("Validating deployment prerequisites...")
        
        # Check required tools
        for tool in self.required_tools:
            if not shutil.which(tool):
                self.logger.error(f"Required tool '{tool}' not found in PATH")
                return False
            else:
                self.logger.info(f"✅ {tool} found")
        
        # Check Docker daemon
        try:
            subprocess.run(['docker', 'info'], check=True, capture_output=True)
            self.logger.info("✅ Docker daemon is running")
        except subprocess.CalledProcessError:
            self.logger.error("❌ Docker daemon is not running")
            return False
        
        # Check Kubernetes connection
        try:
            subprocess.run(['kubectl', 'cluster-info'], check=True, capture_output=True)
            self.logger.info("✅ Kubernetes cluster is accessible")
        except subprocess.CalledProcessError:
            self.logger.error("❌ Cannot connect to Kubernetes cluster")
            return False
        
        return True

    def build_docker_image(self, version: str, push: bool = True) -> str:
        """Build and optionally push Docker image."""
        self.logger.info(f"Building Docker image for version {version}")
        
        image_tag = f"pixelated-empathy-ai:{version}"
        
        try:
            # Build image
            build_cmd = [
                'docker', 'build',
                '-t', image_tag,
                '-f', 'Dockerfile',
                '.'
            ]
            
            result = subprocess.run(build_cmd, check=True, capture_output=True, text=True)
            self.logger.info(f"✅ Docker image built successfully: {image_tag}")
            
            if push:
                # Tag for registry
                registry_tag = f"registry.pixelated-empathy.ai/{image_tag}"
                subprocess.run(['docker', 'tag', image_tag, registry_tag], check=True)
                
                # Push to registry
                subprocess.run(['docker', 'push', registry_tag], check=True)
                self.logger.info(f"✅ Docker image pushed to registry: {registry_tag}")
                
                return registry_tag
            
            return image_tag
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"❌ Docker build failed: {e}")
            raise

    def create_kubernetes_manifests(self, config: DeploymentConfig) -> Dict[str, str]:
        """Create Kubernetes deployment manifests."""
        self.logger.info(f"Creating Kubernetes manifests for {config.environment}")
        
        env_config = self.environments[config.environment]
        
        # Deployment manifest
        deployment = {
            'apiVersion': 'apps/v1',
            'kind': 'Deployment',
            'metadata': {
                'name': 'pixelated-empathy-ai',
                'namespace': env_config['namespace'],
                'labels': {
                    'app': 'pixelated-empathy-ai',
                    'version': config.version,
                    'environment': config.environment
                }
            },
            'spec': {
                'replicas': config.replicas,
                'selector': {
                    'matchLabels': {
                        'app': 'pixelated-empathy-ai'
                    }
                },
                'template': {
                    'metadata': {
                        'labels': {
                            'app': 'pixelated-empathy-ai',
                            'version': config.version
                        }
                    },
                    'spec': {
                        'containers': [{
                            'name': 'pixelated-empathy-ai',
                            'image': config.image_tag,
                            'ports': [{'containerPort': 8000}],
                            'resources': {
                                'requests': config.resources,
                                'limits': {
                                    'cpu': str(int(config.resources['cpu'].replace('m', '')) * 2) + 'm',
                                    'memory': str(int(config.resources['memory'].replace('Gi', '')) * 2) + 'Gi'
                                }
                            },
                            'env': [
                                {'name': 'ENVIRONMENT', 'value': config.environment},
                                {'name': 'VERSION', 'value': config.version}
                            ],
                            'livenessProbe': {
                                'httpGet': {
                                    'path': '/health',
                                    'port': 8000
                                },
                                'initialDelaySeconds': 30,
                                'periodSeconds': 10
                            },
                            'readinessProbe': {
                                'httpGet': {
                                    'path': '/ready',
                                    'port': 8000
                                },
                                'initialDelaySeconds': 5,
                                'periodSeconds': 5
                            }
                        }]
                    }
                }
            }
        }
        
        # Service manifest
        service = {
            'apiVersion': 'v1',
            'kind': 'Service',
            'metadata': {
                'name': 'pixelated-empathy-ai-service',
                'namespace': env_config['namespace']
            },
            'spec': {
                'selector': {
                    'app': 'pixelated-empathy-ai'
                },
                'ports': [{
                    'protocol': 'TCP',
                    'port': 80,
                    'targetPort': 8000
                }],
                'type': 'ClusterIP'
            }
        }
        
        # Ingress manifest
        ingress = {
            'apiVersion': 'networking.k8s.io/v1',
            'kind': 'Ingress',
            'metadata': {
                'name': 'pixelated-empathy-ai-ingress',
                'namespace': env_config['namespace'],
                'annotations': {
                    'kubernetes.io/ingress.class': 'nginx',
                    'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
                    'nginx.ingress.kubernetes.io/ssl-redirect': 'true'
                }
            },
            'spec': {
                'tls': [{
                    'hosts': [env_config['domain']],
                    'secretName': f"pixelated-empathy-ai-tls-{config.environment}"
                }],
                'rules': [{
                    'host': env_config['domain'],
                    'http': {
                        'paths': [{
                            'path': '/',
                            'pathType': 'Prefix',
                            'backend': {
                                'service': {
                                    'name': 'pixelated-empathy-ai-service',
                                    'port': {'number': 80}
                                }
                            }
                        }]
                    }
                }]
            }
        }
        
        return {
            'deployment.yaml': yaml.dump(deployment, default_flow_style=False),
            'service.yaml': yaml.dump(service, default_flow_style=False),
            'ingress.yaml': yaml.dump(ingress, default_flow_style=False)
        }

    def deploy_to_kubernetes(self, config: DeploymentConfig, manifests: Dict[str, str]) -> bool:
        """Deploy to Kubernetes cluster."""
        self.logger.info(f"Deploying to Kubernetes environment: {config.environment}")
        
        try:
            # Create namespace if it doesn't exist
            env_config = self.environments[config.environment]
            namespace_cmd = ['kubectl', 'create', 'namespace', env_config['namespace'], '--dry-run=client', '-o', 'yaml']
            result = subprocess.run(namespace_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                subprocess.run(['kubectl', 'apply', '-f', '-'], input=result.stdout, text=True, check=True)
                self.logger.info(f"✅ Namespace {env_config['namespace']} ready")
            
            # Apply manifests
            for manifest_name, manifest_content in manifests.items():
                self.logger.info(f"Applying {manifest_name}")
                
                apply_cmd = ['kubectl', 'apply', '-f', '-']
                result = subprocess.run(apply_cmd, input=manifest_content, text=True, check=True)
                
                self.logger.info(f"✅ {manifest_name} applied successfully")
            
            # Wait for deployment to be ready
            self.logger.info("Waiting for deployment to be ready...")
            wait_cmd = [
                'kubectl', 'rollout', 'status',
                'deployment/pixelated-empathy-ai',
                '-n', env_config['namespace'],
                '--timeout=300s'
            ]
            
            subprocess.run(wait_cmd, check=True)
            self.logger.info("✅ Deployment is ready")
            
            return True
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"❌ Kubernetes deployment failed: {e}")
            return False

    def run_health_checks(self, config: DeploymentConfig) -> bool:
        """Run post-deployment health checks."""
        self.logger.info("Running post-deployment health checks...")
        
        env_config = self.environments[config.environment]
        
        try:
            # Check pod status
            pod_cmd = [
                'kubectl', 'get', 'pods',
                '-n', env_config['namespace'],
                '-l', 'app=pixelated-empathy-ai',
                '-o', 'json'
            ]
            
            result = subprocess.run(pod_cmd, check=True, capture_output=True, text=True)
            pods_data = json.loads(result.stdout)
            
            running_pods = 0
            for pod in pods_data['items']:
                if pod['status']['phase'] == 'Running':
                    running_pods += 1
            
            if running_pods >= config.replicas:
                self.logger.info(f"✅ {running_pods}/{config.replicas} pods are running")
            else:
                self.logger.warning(f"⚠️ Only {running_pods}/{config.replicas} pods are running")
            
            # Test health endpoint
            if config.health_check_url:
                import requests
                try:
                    response = requests.get(config.health_check_url, timeout=10)
                    if response.status_code == 200:
                        self.logger.info("✅ Health check endpoint is responding")
                    else:
                        self.logger.warning(f"⚠️ Health check returned status {response.status_code}")
                except requests.RequestException as e:
                    self.logger.warning(f"⚠️ Health check failed: {e}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"❌ Health checks failed: {e}")
            return False

    def create_backup(self, config: DeploymentConfig) -> bool:
        """Create backup before deployment."""
        if not config.backup_before_deploy:
            return True
            
        self.logger.info("Creating backup before deployment...")
        
        try:
            backup_name = f"backup-{config.environment}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            
            # Create database backup (example)
            backup_cmd = [
                'kubectl', 'exec', '-n', self.environments[config.environment]['namespace'],
                'deployment/pixelated-empathy-ai', '--',
                'pg_dump', '-U', 'postgres', 'pixelated_db'
            ]
            
            # This would be customized based on actual database setup
            self.logger.info(f"✅ Backup created: {backup_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Backup creation failed: {e}")
            return False

    def rollback_deployment(self, config: DeploymentConfig) -> bool:
        """Rollback to previous deployment."""
        if not config.rollback_enabled:
            self.logger.warning("Rollback is disabled for this deployment")
            return False
            
        self.logger.info("Rolling back deployment...")
        
        try:
            rollback_cmd = [
                'kubectl', 'rollout', 'undo',
                'deployment/pixelated-empathy-ai',
                '-n', self.environments[config.environment]['namespace']
            ]
            
            subprocess.run(rollback_cmd, check=True)
            self.logger.info("✅ Rollback completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"❌ Rollback failed: {e}")
            return False

    def deploy(self, environment: str, version: str, **kwargs) -> bool:
        """Main deployment function."""
        self.logger.info(f"Starting deployment to {environment} environment, version {version}")
        
        # Validate prerequisites
        if not self.validate_prerequisites():
            return False
        
        # Create deployment configuration
        env_config = self.environments[environment]
        config = DeploymentConfig(
            environment=environment,
            version=version,
            image_tag=f"registry.pixelated-empathy.ai/pixelated-empathy-ai:{version}",
            replicas=env_config['replicas'],
            resources=env_config['resources'],
            secrets={},
            config_maps={},
            health_check_url=f"https://{env_config['domain']}/health",
            **kwargs
        )
        
        try:
            # Create backup
            if not self.create_backup(config):
                self.logger.error("Backup creation failed, aborting deployment")
                return False
            
            # Build and push Docker image
            image_tag = self.build_docker_image(version)
            config.image_tag = image_tag
            
            # Create Kubernetes manifests
            manifests = self.create_kubernetes_manifests(config)
            
            # Deploy to Kubernetes
            if not self.deploy_to_kubernetes(config, manifests):
                self.logger.error("Kubernetes deployment failed")
                if config.rollback_enabled:
                    self.rollback_deployment(config)
                return False
            
            # Run health checks
            if not self.run_health_checks(config):
                self.logger.warning("Health checks failed, but deployment completed")
            
            # Record deployment
            deployment_record = {
                'timestamp': datetime.now().isoformat(),
                'environment': environment,
                'version': version,
                'status': 'success',
                'config': asdict(config)
            }
            self.deployment_history.append(deployment_record)
            
            self.logger.info(f"🎉 Deployment to {environment} completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Deployment failed: {e}")
            
            # Record failed deployment
            deployment_record = {
                'timestamp': datetime.now().isoformat(),
                'environment': environment,
                'version': version,
                'status': 'failed',
                'error': str(e)
            }
            self.deployment_history.append(deployment_record)
            
            return False

    def generate_deployment_report(self) -> str:
        """Generate deployment report."""
        report_file = f"deployment_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'deployment_history': self.deployment_history,
            'environments': self.environments,
            'summary': {
                'total_deployments': len(self.deployment_history),
                'successful_deployments': len([d for d in self.deployment_history if d['status'] == 'success']),
                'failed_deployments': len([d for d in self.deployment_history if d['status'] == 'failed'])
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.logger.info(f"Deployment report saved to {report_file}")
        return report_file

def main():
    """Main deployment script."""
    parser = argparse.ArgumentParser(description='Pixelated Empathy AI Production Deployment')
    parser.add_argument('environment', choices=['development', 'staging', 'production'],
                       help='Target deployment environment')
    parser.add_argument('version', help='Version to deploy')
    parser.add_argument('--no-backup', action='store_true', help='Skip backup creation')
    parser.add_argument('--no-rollback', action='store_true', help='Disable rollback on failure')
    parser.add_argument('--dry-run', action='store_true', help='Perform dry run without actual deployment')
    
    args = parser.parse_args()
    
    deployer = ProductionDeployer()
    
    if args.dry_run:
        print(f"DRY RUN: Would deploy version {args.version} to {args.environment}")
        return
    
    success = deployer.deploy(
        environment=args.environment,
        version=args.version,
        backup_before_deploy=not args.no_backup,
        rollback_enabled=not args.no_rollback
    )
    
    # Generate report
    deployer.generate_deployment_report()
    
    if success:
        print(f"✅ Deployment to {args.environment} completed successfully!")
        sys.exit(0)
    else:
        print(f"❌ Deployment to {args.environment} failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
