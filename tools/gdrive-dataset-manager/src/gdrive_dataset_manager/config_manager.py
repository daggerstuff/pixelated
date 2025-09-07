"""
Configuration management for Google Drive Dataset Manager.
"""

import logging
from pathlib import Path
from typing import Any

import yaml
from rich.console import Console

logger = logging.getLogger(__name__)
console = Console()

class ConfigManager:
    """Manages configuration for the Google Drive Dataset Manager."""
    
    DEFAULT_CONFIG = {
        "google_drive": {
            "folder_id": "",
            "credentials_file": "credentials.json",
            "application_name": "Pixelated Dataset Manager"
        },
        "local": {
            "datasets_path": "../../ai/datasets",
            "processed_path": "../../ai/data/processed",
            "temp_path": "./temp"
        },
        "download": {
            "chunk_size": 1048576,  # 1MB
            "max_retries": 3,
            "timeout": 300
        },
        "upload": {
            "chunk_size": 1048576,  # 1MB
            "max_file_size": 10737418240,  # 10GB
            "compress": True
        },
        "logging": {
            "level": "INFO",
            "file": "gdrive_manager.log",
            "max_file_size": 10485760,  # 10MB
            "backup_count": 5
        }
    }
    
    def __init__(self, config_path: str | Path = "config.yaml"):
        """
        Initialize the configuration manager.
        
        Args:
            config_path: Path to the configuration file
        """
        self.config_path = Path(config_path)
        self.config = self.DEFAULT_CONFIG.copy()
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, "r") as f:
                    user_config = yaml.safe_load(f)
                
                if user_config:
                    self._merge_config(self.config, user_config)
                    logger.info(f"Loaded configuration from {self.config_path}")
                else:
                    logger.warning(f"Empty configuration file: {self.config_path}")
            else:
                logger.info(f"Configuration file not found: {self.config_path}, using defaults")
                self._save_config()
                
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML configuration: {e}")
            console.print(f"[red]Error parsing configuration file: {e}[/red]")
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            console.print(f"[red]Error loading configuration: {e}[/red]")
    
    def _merge_config(self, default: dict[str, Any], user: dict[str, Any]) -> None:
        """
        Recursively merge user configuration with defaults.
        
        Args:
            default: Default configuration dictionary
            user: User configuration dictionary
        """
        for key, value in user.items():
            if key in default and isinstance(default[key], dict) and isinstance(value, dict):
                self._merge_config(default[key], value)
            else:
                default[key] = value
    
    def _save_config(self) -> None:
        """Save current configuration to file."""
        try:
            with open(self.config_path, "w") as f:
                yaml.dump(self.config, f, default_flow_style=False, indent=2)
            logger.info(f"Saved configuration to {self.config_path}")
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value using dot notation.
        
        Args:
            key: Configuration key (e.g., "google_drive.folder_id")
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        try:
            keys = key.split(".")
            value = self.config
            
            for k in keys:
                value = value[k]
            
            return value
            
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any) -> None:
        """
        Set a configuration value using dot notation.
        
        Args:
            key: Configuration key (e.g., "google_drive.folder_id")
            value: Value to set
        """
        try:
            keys = key.split(".")
            config_dict = self.config
            
            # Navigate to the parent dictionary
            for k in keys[:-1]:
                if k not in config_dict:
                    config_dict[k] = {}
                config_dict = config_dict[k]
            
            # Set the value
            config_dict[keys[-1]] = value
            logger.debug(f"Set configuration: {key} = {value}")
            
        except Exception as e:
            logger.error(f"Error setting configuration {key}: {e}")
    
    def validate(self) -> list[str]:
        """
        Validate the current configuration.
        
        Returns:
            List of validation error messages
        """
        errors = []
        
        # Check required Google Drive settings
        if not self.get("google_drive.folder_id"):
            errors.append("Google Drive folder_id is required")
        
        if not self.get("google_drive.credentials_file"):
            errors.append("Google Drive credentials_file is required")
        
        # Check credentials file exists
        credentials_path = Path(self.get("google_drive.credentials_file"))
        if not credentials_path.exists():
            errors.append(f"Credentials file not found: {credentials_path}")
        
        # Validate numeric values
        chunk_size = self.get("download.chunk_size")
        if not isinstance(chunk_size, int) or chunk_size <= 0:
            errors.append("download.chunk_size must be a positive integer")
        
        max_file_size = self.get("upload.max_file_size")
        if not isinstance(max_file_size, int) or max_file_size <= 0:
            errors.append("upload.max_file_size must be a positive integer")
        
        # Validate paths
        for path_key in ["local.datasets_path", "local.processed_path", "local.temp_path"]:
            path_value = self.get(path_key)
            if not path_value:
                errors.append(f"{path_key} is required")
        
        # Validate logging level
        log_level = self.get("logging.level")
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if log_level not in valid_levels:
            errors.append(f"logging.level must be one of {valid_levels}")
        
        return errors
    
    def display_config(self) -> None:
        """Display current configuration in a readable format."""
        console.print("[cyan]Current Configuration:[/cyan]")
        console.print(yaml.dump(self.config, default_flow_style=False, indent=2))
    
    def create_example_config(self, output_path: str | Path = "config.example.yaml") -> None:
        """
        Create an example configuration file.
        
        Args:
            output_path: Path for the example configuration file
        """
        try:
            example_config = self.DEFAULT_CONFIG.copy()
            
            # Add comments and examples
            example_config["google_drive"]["folder_id"] = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE"
            
            with open(output_path, "w") as f:
                f.write("# Google Drive Dataset Manager Configuration\n")
                f.write("# Copy this file to config.yaml and update the values\n\n")
                yaml.dump(example_config, f, default_flow_style=False, indent=2)
            
            console.print(f"[green]Created example configuration: {output_path}[/green]")
            logger.info(f"Created example configuration: {output_path}")
            
        except Exception as e:
            logger.error(f"Error creating example configuration: {e}")
            console.print(f"[red]Error creating example configuration: {e}[/red]")
    
    def reset_to_defaults(self) -> None:
        """Reset configuration to default values."""
        self.config = self.DEFAULT_CONFIG.copy()
        logger.info("Reset configuration to defaults")
    
    def get_credentials_path(self) -> Path:
        """Get the path to the Google API credentials file."""
        return Path(self.get("google_drive.credentials_file"))
    
    def get_local_paths(self) -> dict[str, Path]:
        """
        Get all local paths as Path objects.
        
        Returns:
            Dictionary with Path objects for local directories
        """
        return {
            "datasets": Path(self.get("local.datasets_path")),
            "processed": Path(self.get("local.processed_path")),
            "temp": Path(self.get("local.temp_path"))
        }
    
    def ensure_local_paths(self) -> None:
        """Create local directories if they don't exist."""
        paths = self.get_local_paths()
        
        for name, path in paths.items():
            try:
                path.mkdir(parents=True, exist_ok=True)
                logger.debug(f"Ensured directory exists: {name} -> {path}")
            except Exception as e:
                logger.error(f"Failed to create directory {name} ({path}): {e}")
                console.print(f"[red]Failed to create directory {name}: {e}[/red]")
    
    def save(self) -> None:
        """Save current configuration to file."""
        self._save_config()
    
    def reload(self) -> None:
        """Reload configuration from file."""
        self._load_config()
    
    def update_from_dict(self, updates: dict[str, Any]) -> None:
        """
        Update configuration from a dictionary.
        
        Args:
            updates: Dictionary with configuration updates
        """
        self._merge_config(self.config, updates)
        logger.info("Updated configuration from dictionary")
    
    def to_dict(self) -> dict[str, Any]:
        """
        Get configuration as a dictionary.
        
        Returns:
            Configuration dictionary
        """
        return self.config.copy()
    
    def setup_logging(self) -> None:
        """Setup logging based on configuration."""
        log_level = getattr(logging, self.get("logging.level"), logging.INFO)
        log_file = self.get("logging.file")
        
        # Configure logging
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        
        logger.info(f"Logging configured: level={self.get('logging.level')}, file={log_file}")
    
    def get_summary(self) -> dict[str, Any]:
        """
        Get a summary of the configuration.
        
        Returns:
            Dictionary with configuration summary
        """
        return {
            "config_file": str(self.config_path),
            "config_exists": self.config_path.exists(),
            "google_drive_configured": bool(self.get("google_drive.folder_id")),
            "credentials_exists": self.get_credentials_path().exists(),
            "local_paths": {k: str(v) for k, v in self.get_local_paths().items()},
            "validation_errors": self.validate()
        }
