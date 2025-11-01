#!/usr/bin/env python3
"""
Production Configuration Management System for Pixelated Empathy AI
Manages environment-specific configurations with security and validation.
"""

import os
import json
import yaml
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime
from enum import Enum
import hashlib
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

class Environment(Enum):
    """Supported deployment environments."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"

class ConfigType(Enum):
    """Types of configuration values."""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    LIST = "list"
    DICT = "dict"
    SECRET = "secret"
    URL = "url"
    EMAIL = "email"

@dataclass
class ConfigItem:
    """Individual configuration item."""
    key: str
    value: Any
    config_type: ConfigType
    environment: Environment
    description: str
    required: bool = True
    sensitive: bool = False
    encrypted: bool = False
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class ConfigValidationResult:
    """Result of configuration validation."""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    missing_required: List[str] = field(default_factory=list)

class ConfigurationManager:
    """Comprehensive configuration management system."""
    
    def __init__(self, config_dir: str = None):
        self.logger = logging.getLogger(__name__)
        self.configs = {}
        self.environments = {}
        self.config_dir = Path(config_dir) if config_dir else Path('/home/vivi/pixelated/ai/production_deployment')
        self.encryption_key = None
        self.fernet = None
        
        # Initialize encryption
        self._setup_encryption()
        
        # Load configurations for all environments
        self._load_all_configurations()
    
    def _setup_encryption(self):
        """Setup encryption for sensitive configurations."""
        try:
            # Try to load existing key
            key_file = self.config_dir / 'encryption.key'
            if key_file.exists():
                with open(key_file, 'rb') as f:
                    self.encryption_key = f.read()
            else:
                # Generate new key
                self.encryption_key = Fernet.generate_key()
                with open(key_file, 'wb') as f:
                    f.write(self.encryption_key)
                os.chmod(key_file, 0o600)
            
            self.fernet = Fernet(self.encryption_key)
            self.logger.info("Encryption setup completed")
        except Exception as e:
            self.logger.warning(f"Encryption setup failed: {e}")
    
    def _load_all_configurations(self):
        """Load configurations for all environments."""
        for env in Environment:
            self.environments[env.value] = {}
            self.configs[env.value] = {}
            
            # Load from various config files
            config_files = [
                f'{env.value}_config.json',
                f'{env.value}_config.yaml',
                'secure_config.json',
                'database_config.json',
                'cache_config.json',
                'monitoring_config.json',
                'security_policy.json'
            ]
            
            for config_file in config_files:
                config_path = self.config_dir / config_file
                if config_path.exists():
                    try:
                        self._load_config_file(config_path, env)
                    except Exception as e:
                        self.logger.warning(f"Failed to load {config_file}: {e}")
        
        self.logger.info(f"Loaded configurations for {len(self.environments)} environments")
    
    def _load_config_file(self, config_path: Path, environment: Environment):
        """Load configuration from a file."""
        try:
            if config_path.suffix == '.json':
                with open(config_path, 'r') as f:
                    data = json.load(f)
            elif config_path.suffix in ['.yaml', '.yml']:
                with open(config_path, 'r') as f:
                    data = yaml.safe_load(f)
            else:
                return
            
            # Process the loaded data
            self._process_config_data(data, environment, config_path.name)
            
        except Exception as e:
            self.logger.error(f"Error loading config file {config_path}: {e}")
    
    def _process_config_data(self, data: Dict, environment: Environment, source: str):
        """Process configuration data into ConfigItems."""
        if not isinstance(data, dict):
            return
        
        for key, value in data.items():
            config_item = ConfigItem(
                key=key,
                value=value,
                config_type=self._infer_config_type(value),
                environment=environment,
                description=f"Configuration from {source}",
                sensitive=self._is_sensitive_key(key)
            )
            
            self.configs[environment.value][key] = config_item
            self.environments[environment.value][key] = value
    
    def _infer_config_type(self, value: Any) -> ConfigType:
        """Infer configuration type from value."""
        if isinstance(value, str):
            if '@' in value and '.' in value:
                return ConfigType.EMAIL
            elif value.startswith(('http://', 'https://')):
                return ConfigType.URL
            elif any(secret_word in value.lower() for secret_word in ['password', 'key', 'secret', 'token']):
                return ConfigType.SECRET
            return ConfigType.STRING
        elif isinstance(value, int):
            return ConfigType.INTEGER
        elif isinstance(value, float):
            return ConfigType.FLOAT
        elif isinstance(value, bool):
            return ConfigType.BOOLEAN
        elif isinstance(value, list):
            return ConfigType.LIST
        elif isinstance(value, dict):
            return ConfigType.DICT
        return ConfigType.STRING
    
    def _is_sensitive_key(self, key: str) -> bool:
        """Check if a configuration key is sensitive."""
        sensitive_keywords = ['password', 'key', 'secret', 'token', 'credential', 'auth']
        return any(keyword in key.lower() for keyword in sensitive_keywords)
    
    def get_config(self, key: str, environment: str = 'production', default: Any = None) -> Any:
        """Get configuration value."""
        try:
            if environment in self.environments and key in self.environments[environment]:
                return self.environments[environment][key]
            return default
        except Exception as e:
            self.logger.error(f"Error getting config {key}: {e}")
            return default
    
    def set_config(self, key: str, value: Any, environment: str = 'production', 
                   description: str = "", sensitive: bool = False) -> bool:
        """Set configuration value."""
        try:
            config_item = ConfigItem(
                key=key,
                value=value,
                config_type=self._infer_config_type(value),
                environment=Environment(environment),
                description=description,
                sensitive=sensitive
            )
            
            if environment not in self.configs:
                self.configs[environment] = {}
                self.environments[environment] = {}
            
            self.configs[environment][key] = config_item
            self.environments[environment][key] = value
            
            return True
        except Exception as e:
            self.logger.error(f"Error setting config {key}: {e}")
            return False
    
    def validate_configuration(self, environment: str = 'production') -> ConfigValidationResult:
        """Validate configuration for an environment."""
        result = ConfigValidationResult(is_valid=True)
        
        try:
            if environment not in self.configs:
                result.is_valid = False
                result.errors.append(f"Environment {environment} not found")
                return result
            
            # Check required configurations
            required_configs = ['database_url', 'redis_url', 'secret_key']
            for required_config in required_configs:
                if required_config not in self.environments[environment]:
                    result.missing_required.append(required_config)
                    result.is_valid = False
            
            # Validate configuration values
            for key, config_item in self.configs[environment].items():
                if config_item.config_type == ConfigType.URL:
                    if not config_item.value.startswith(('http://', 'https://')):
                        result.warnings.append(f"URL {key} may be invalid")
                elif config_item.config_type == ConfigType.EMAIL:
                    if '@' not in config_item.value:
                        result.errors.append(f"Email {key} is invalid")
                        result.is_valid = False
            
        except Exception as e:
            result.is_valid = False
            result.errors.append(f"Validation error: {e}")
        
        return result
    
    def export_configuration(self, environment: str, include_sensitive: bool = False) -> Dict:
        """Export configuration for an environment."""
        try:
            if environment not in self.environments:
                return {}
            
            exported = {}
            for key, value in self.environments[environment].items():
                config_item = self.configs[environment].get(key)
                if config_item and config_item.sensitive and not include_sensitive:
                    exported[key] = "***REDACTED***"
                else:
                    exported[key] = value
            
            return exported
        except Exception as e:
            self.logger.error(f"Error exporting configuration: {e}")
            return {}
    
    def get_all_environments(self) -> List[str]:
        """Get list of all configured environments."""
        return list(self.environments.keys())
    
    def get_environment_summary(self, environment: str) -> Dict:
        """Get summary of environment configuration."""
        try:
            if environment not in self.configs:
                return {}
            
            summary = {
                'environment': environment,
                'total_configs': len(self.configs[environment]),
                'sensitive_configs': sum(1 for item in self.configs[environment].values() if item.sensitive),
                'config_types': {},
                'last_updated': max([item.last_updated for item in self.configs[environment].values()], default=datetime.now()).isoformat()
            }
            
            # Count by type
            for item in self.configs[environment].values():
                type_name = item.config_type.value
                summary['config_types'][type_name] = summary['config_types'].get(type_name, 0) + 1
            
            return summary
        except Exception as e:
            self.logger.error(f"Error getting environment summary: {e}")
            return {}
