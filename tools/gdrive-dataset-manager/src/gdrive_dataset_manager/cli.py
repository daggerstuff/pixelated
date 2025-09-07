#!/usr/bin/env python3
"""
Google Drive Dataset Manager
A command-line tool for managing datasets on Google Drive.
"""

import sys
import logging
from pathlib import Path
from functools import wraps

import click
from rich.console import Console
from rich.table import Table
from rich import traceback

from .config_manager import ConfigManager
from .auth import DriveAuthenticator
from .lister import DatasetLister
from .downloader import DatasetDownloader
from .uploader import DatasetUploader

# Enable rich traceback handling
traceback.install()

console = Console()

def setup_logging(config):
    """Setup logging based on configuration."""
    try:
        config.setup_logging()
    except Exception as e:
        console.print(f"[red]Failed to setup logging: {e}[/red]")

def handle_error(func):
    """Decorator to handle common errors gracefully."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except KeyboardInterrupt:
            console.print("\n[yellow]Operation cancelled by user[/yellow]")
            sys.exit(1)
        except Exception as e:
            logging.error(f"Unexpected error in {func.__name__}: {e}")
            console.print(f"[red]Error: {e}[/red]")
            if "--debug" in sys.argv:
                console.print_exception()
            sys.exit(1)
    return wrapper

def validate_config(ctx):
    """Validate configuration for commands that need valid setup."""
    if errors := ctx.obj.get("validation_errors", []):
        console.print("[red]Configuration errors found:[/red]")
        for error in errors:
            console.print(f"  • {error}")
        console.print("\n[yellow]Run 'python gdrive_cli.py auth' to setup authentication[/yellow]")
        sys.exit(1)

@click.group()
@click.option("--config", "-c", default="config.yaml", help="Configuration file path")
@click.option("--debug", is_flag=True, help="Enable debug mode")
@click.pass_context
def cli(ctx: click.Context, config: str, debug: bool):
    """Google Drive Dataset Manager - Manage datasets on Google Drive."""
    # Setup context
    ctx.ensure_object(dict)
    
    # Load configuration
    config_manager = ConfigManager(config)
    ctx.obj["config"] = config_manager
    ctx.obj["debug"] = debug
    
    # Setup logging
    if debug:
        config_manager.set("logging.level", "DEBUG")
    setup_logging(config_manager)
    
    # Store validation errors for use by commands
    ctx.obj["validation_errors"] = config_manager.validate()

@cli.command()
@click.pass_context
@handle_error
def auth(ctx):
    """Setup Google Drive authentication."""
    config = ctx.obj["config"]
    
    console.print("[cyan]Setting up Google Drive authentication...[/cyan]")
    
    # Check if credentials file exists
    credentials_path = config.get_credentials_path()
    if not credentials_path.exists():
        console.print(f"[red]Credentials file not found: {credentials_path}[/red]")
        console.print("\n[yellow]Please follow these steps:[/yellow]")
        console.print("1. Go to https://console.cloud.google.com/")
        console.print("2. Create a new project or select an existing one")
        console.print("3. Enable the Google Drive API")
        console.print("4. Create credentials (OAuth 2.0 Client ID)")
        console.print("5. Download the credentials JSON file")
        console.print(f"6. Save it as: {credentials_path}")
        return
    
    # Initialize authenticator
    authenticator = DriveAuthenticator(str(credentials_path))
    
    # Authenticate
    if authenticator.authenticate():
        console.print("[green]✓ Authentication successful![/green]")
        
        # Test connection
        if authenticator.test_connection():
            console.print("[green]✓ Connection test passed[/green]")
        else:
            console.print("[yellow]⚠ Authentication succeeded but connection test failed[/yellow]")
    else:
        console.print("[red]✗ Authentication failed[/red]")

@cli.command(name="list")
@click.option("--details", "-d", is_flag=True, help="Show detailed information")
@click.option("--search", "-s", help="Search datasets by name")
@click.pass_context
@handle_error
def list_datasets(ctx, details, search):
    """List datasets available on Google Drive."""
    validate_config(ctx)
    config = ctx.obj["config"]
    
    # Setup services
    authenticator = DriveAuthenticator(str(config.get_credentials_path()))
    if not authenticator.authenticate():
        console.print("[red]Authentication failed[/red]")
        return
    
    lister = DatasetLister(authenticator, config.get("google_drive.folder_id"))
    
    # List or search datasets
    if search:
        console.print(f"[cyan]Searching for datasets matching: {search}[/cyan]")
        datasets = lister.search_datasets(search)
    else:
        datasets = lister.list_datasets(details)
    
    # Display results
    lister.display_datasets(datasets, details)

@cli.command()
@click.argument("dataset_name")
@click.option("--destination", "-d", help="Custom destination path")
@click.option("--verify", is_flag=True, help="Verify download after completion")
@click.pass_context
@handle_error
def download(ctx, dataset_name, destination, verify):
    """Download a dataset from Google Drive."""
    validate_config(ctx)
    config = ctx.obj["config"]
    
    # Setup services
    authenticator = DriveAuthenticator(str(config.get_credentials_path()))
    if not authenticator.authenticate():
        console.print("[red]Authentication failed[/red]")
        return
    
    lister = DatasetLister(authenticator, config.get("google_drive.folder_id"))
    downloader = DatasetDownloader(authenticator, config.to_dict())
    
    # Find the dataset
    console.print(f"[cyan]Searching for dataset: {dataset_name}[/cyan]")
    datasets = lister.search_datasets(dataset_name)
    
    if not datasets:
        console.print(f"[red]Dataset not found: {dataset_name}[/red]")
        return
    
    if len(datasets) > 1:
        console.print(f"[yellow]Multiple datasets found matching '{dataset_name}':[/yellow]")
        lister.display_datasets(datasets)
        console.print("[yellow]Please be more specific[/yellow]")
        return
    
    # Download the dataset
    dataset = datasets[0]
    dataset_id = dataset["id"]
    
    if destination:
        destination = Path(destination)
    else:
        destination = Path(config.get("local_storage.datasets_path"))
    
    console.print(f"[cyan]Downloading to: {destination}[/cyan]")
    
    success = downloader.download_dataset(dataset_id, dataset["name"], str(destination))
    
    if success and verify:
        console.print("[cyan]Verifying download...[/cyan]")
        if downloader.verify_download(dataset_id, destination / dataset["name"]):
            console.print("[green]✓ Download verification passed[/green]")
        else:
            console.print("[yellow]⚠ Download verification failed[/yellow]")

@cli.command()
@click.argument("file_or_folder", type=click.Path(exists=True))
@click.option("--name", help="Custom name for the dataset")
@click.option("--folder", help="Folder to organize the dataset in")
@click.option("--no-compress", is_flag=True, help="Disable automatic compression")
@click.pass_context
@handle_error
def upload(ctx, file_or_folder, name, folder, no_compress):
    """Upload a file or folder to Google Drive."""
    validate_config(ctx)
    config = ctx.obj["config"]

    # Setup services
    authenticator = DriveAuthenticator(str(config.get_credentials_path()))
    if not authenticator.authenticate():
        console.print("[red]Authentication failed[/red]")
        return

    uploader = DatasetUploader(authenticator, config.to_dict())

    # Upload the file or folder
    source_path = Path(file_or_folder)

    dataset_name = name or source_path.name
    console.print(f"[cyan]Uploading {source_path} as '{dataset_name}'[/cyan]")

    if success := uploader.upload_dataset(
        source_path, dataset_name, compress=(not no_compress)
    ):
        console.print("[green]✓ Upload completed successfully[/green]")
    else:
        console.print("[red]✗ Upload failed[/red]")

@cli.command("config-info")
@click.pass_context
@handle_error
def config_info(ctx):
    """Display current configuration information."""
    config = ctx.obj["config"]

    table = Table(title="Configuration Information")
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Status", style="yellow")

    # Basic configuration
    table.add_row("Config File", str(config.config_path), "✓" if config.config_path.exists() else "✗")
    table.add_row("Credentials File", str(config.get_credentials_path()), "✓" if config.get_credentials_path().exists() else "✗")
    table.add_row("Google Drive Folder ID", config.get("google_drive.folder_id"), "✓" if config.get("google_drive.folder_id") else "✗")

    # Paths
    table.add_row("Local Datasets Path", config.get("local_storage.datasets_path"), "")
    table.add_row("Local Downloads Path", config.get("local_storage.downloads_path"), "")

    console.print(table)

    if errors := ctx.obj.get("validation_errors", []):
        console.print("\n[red]Configuration Issues:[/red]")
        for error in errors:
            console.print(f"  • {error}")

@cli.command()
@click.pass_context
@handle_error
def quota(ctx):
    """Check Google Drive quota and usage."""
    validate_config(ctx)
    config = ctx.obj["config"]

    authenticator = DriveAuthenticator(str(config.get_credentials_path()))
    if not authenticator.authenticate():
        console.print("[red]Authentication failed[/red]")
        return

    uploader = DatasetUploader(authenticator, config.to_dict())
    if quota_info := uploader.get_upload_quota():
        table = Table(title="Google Drive Storage")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Total Storage", quota_info["total"])
        table.add_row("Used Storage", quota_info["used"])
        table.add_row("Available Storage", quota_info["available"])
        table.add_row("Usage Percentage", f"{quota_info['usage_percent']:.1f}%")

        console.print(table)
    else:
        console.print("[red]Failed to retrieve quota information[/red]")

@cli.command()
@click.option("--all", "cleanup_all", is_flag=True, help="Remove all temporary files and logs")
@click.pass_context
@handle_error
def cleanup(ctx, cleanup_all):
    """Clean up temporary files."""
    config = ctx.obj["config"]
    
    if cleanup_all:
        # Setup services for cleanup
        authenticator = DriveAuthenticator(str(config.get_credentials_path()))
        
        try:
            downloader = DatasetDownloader(authenticator, config.to_dict())
            downloader.cleanup_temp_files()
            
            uploader = DatasetUploader(authenticator, config.to_dict())
            uploader.cleanup_temp_files()
            
            console.print("[green]✓ All temporary files cleaned up[/green]")
        except Exception as e:
            console.print(f"[yellow]Warning: {e}[/yellow]")
    
    # Clean up log files if they're too large
    log_file = Path(config.get("logging.file"))
    max_size = config.get("logging.max_file_size")
    
    if log_file.exists() and log_file.stat().st_size > max_size:
        try:
            # Rotate log file
            backup_file = log_file.with_suffix(".log.1")
            if backup_file.exists():
                backup_file.unlink()
            log_file.rename(backup_file)
            console.print("[green]✓ Log file rotated[/green]")
        except Exception as e:
            console.print(f"[yellow]Warning: Failed to rotate log file: {e}[/yellow]")

if __name__ == "__main__":
    cli(obj={})
