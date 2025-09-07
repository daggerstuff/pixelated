"""
Dataset download functionality for Google Drive.
"""

import os
import logging
import zipfile
import shutil
from pathlib import Path
from typing import Any
from io import BytesIO

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from tqdm import tqdm
from rich.console import Console
from rich.progress import (
    Progress,
    BarColumn,
    TextColumn,
    DownloadColumn,
    TimeRemainingColumn,
    SpinnerColumn
)

from .auth import DriveAuthenticator

logger = logging.getLogger(__name__)
console = Console()

class DatasetDownloader:
    """Handles downloading datasets from Google Drive."""
    
    def __init__(self, authenticator: DriveAuthenticator, config: dict[str, Any]):
        """
        Initialize the dataset downloader.
        
        Args:
            authenticator: Authenticated DriveAuthenticator instance
            config: Configuration dictionary containing download settings
        """
        self.authenticator = authenticator
        self.config = config
        self.service = authenticator.get_service()
        
        # Create local directories if they don't exist
        self.datasets_path = Path(config["local"]["datasets_path"])
        self.processed_path = Path(config["local"]["processed_path"])
        self.temp_path = Path(config["local"]["temp_path"])
        
        for path in [self.datasets_path, self.processed_path, self.temp_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    def download_dataset(self, dataset_id: str, dataset_name: str, destination: str | None = None) -> bool:
        """
        Download a single dataset from Google Drive.
        
        Args:
            dataset_id: Google Drive file/folder ID
            dataset_name: Name of the dataset
            destination: Optional custom destination path
            
        Returns:
            bool: True if download successful, False otherwise
        """
        try:
            # Get dataset metadata
            metadata = self._get_dataset_metadata(dataset_id)
            if not metadata:
                logger.error(f"Failed to get metadata for dataset: {dataset_name}")
                return False
            
            # Determine destination path
            if destination:
                dest_path = Path(destination)
            else:
                dest_path = self.datasets_path / dataset_name
            
            dest_path.mkdir(parents=True, exist_ok=True)
            
            # Check if it's a folder or file
            if metadata["mimeType"] == "application/vnd.google-apps.folder":
                return self._download_folder(dataset_id, dest_path, dataset_name)
            else:
                return self._download_file(dataset_id, dest_path / dataset_name, metadata)
                
        except Exception as e:
            logger.error(f"Error downloading dataset {dataset_name}: {e}")
            return False
    
    def _get_dataset_metadata(self, dataset_id: str) -> dict[str, Any] | None:
        """Get metadata for a dataset."""
        try:
            return self.service.files().get(
                fileId=dataset_id,
                fields="id, name, size, mimeType, parents"
            ).execute()
        except HttpError as e:
            logger.error(f"HTTP error getting metadata: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting metadata: {e}")
            return None
    
    def _download_file(self, file_id: str, dest_path: Path, metadata: dict[str, Any]) -> bool:
        """
        Download a single file from Google Drive.
        
        Args:
            file_id: Google Drive file ID
            dest_path: Local destination path
            metadata: File metadata
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            file_size = int(metadata.get("size", 0))

            with Progress(
                        SpinnerColumn(),
                        TextColumn("[progress.description]{task.description}"),
                        BarColumn(),
                        DownloadColumn(),
                        TimeRemainingColumn(),
                        console=console
                    ) as progress:
                
                task_id = progress.add_task(
                    description=f"Downloading {metadata['name']}",
                    total=file_size
                )

                # Create request for file download
                request = self.service.files().get_media(fileId=file_id)

                # Download in chunks
                with open(dest_path, "wb") as f:
                    downloader = MediaIoBaseDownload(f, request)
                    done = False

                    while not done:
                        status, done = downloader.next_chunk()
                        if status:
                            progress.update(
                                task_id,
                                completed=int(status.progress() * file_size)
                            )

            logger.info(f"Successfully downloaded: {dest_path}")
            return True

        except HttpError as e:
            logger.error(f"HTTP error downloading file: {e}")
            return False
        except Exception as e:
            logger.error(f"Error downloading file: {e}")
            return False
    
    def _download_folder(self, folder_id: str, dest_path: Path, folder_name: str) -> bool:
        """
        Download all files in a Google Drive folder.
        
        Args:
            folder_id: Google Drive folder ID
            dest_path: Local destination path
            folder_name: Name of the folder
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            return self._extracted_from__download_folder_15(
                folder_id, folder_name, dest_path
            )
        except HttpError as e:
            logger.error(f"HTTP error downloading folder: {e}")
            return False
        except Exception as e:
            logger.error(f"Error downloading folder: {e}")
            return False

    # TODO Rename this here and in `_download_folder`
    def _extracted_from__download_folder_15(self, folder_id, folder_name, dest_path):
        # Get all files in the folder
        query = f"'{folder_id}' in parents and trashed=false"
        results = self.service.files().list(
            q=query,
            fields="files(id, name, size, mimeType, parents)"
        ).execute()

        files = results.get("files", [])
        if not files:
            logger.warning(f"No files found in folder: {folder_name}")
            return True

        console.print(f"[cyan]Downloading folder: {folder_name} ({len(files)} files)[/cyan]")

        success_count = 0
        total_files = len(files)

        for file_info in files:
            file_dest = dest_path / file_info["name"]

            if file_info["mimeType"] == "application/vnd.google-apps.folder":
                # Recursive folder download
                subfolder_path = dest_path / file_info["name"]
                subfolder_path.mkdir(exist_ok=True)
                if self._download_folder(file_info["id"], subfolder_path, file_info["name"]):
                    success_count += 1
            elif self._download_file(file_info["id"], file_dest, file_info):
                success_count += 1

        console.print(f"[green]Folder download complete: {success_count}/{total_files} files successful[/green]")
        return success_count == total_files
    
    def download_multiple_datasets(self, dataset_specs: list[dict[str, str]]) -> dict[str, bool]:
        """
        Download multiple datasets.
        
        Args:
            dataset_specs: List of dictionaries with 'id', 'name', and optional 'destination'
            
        Returns:
            Dictionary mapping dataset names to success status
        """
        results = {}
        
        console.print(f"[cyan]Starting download of {len(dataset_specs)} datasets...[/cyan]")
        
        for spec in dataset_specs:
            dataset_id = spec["id"]
            dataset_name = spec["name"]
            destination = spec.get("destination")
            
            console.print(f"\n[yellow]Processing: {dataset_name}[/yellow]")
            
            success = self.download_dataset(dataset_id, dataset_name, destination)
            results[dataset_name] = success
            
            if success:
                console.print(f"[green]✓ {dataset_name} downloaded successfully[/green]")
            else:
                console.print(f"[red]✗ {dataset_name} download failed[/red]")
        
        # Summary
        successful = sum(bool(success)
                     for success in results.values())
        console.print(f"\n[cyan]Download Summary: {successful}/{len(dataset_specs)} successful[/cyan]")
        
        return results
    
    def resume_download(self, dataset_id: str, dataset_name: str, destination: str | None = None) -> bool:
        """
        Resume a partially downloaded dataset.
        
        Args:
            dataset_id: Google Drive file/folder ID
            dataset_name: Name of the dataset
            destination: Optional custom destination path
            
        Returns:
            bool: True if resume successful, False otherwise
        """
        # For simplicity, this implementation re-downloads
        # In a production version, you would implement proper resume logic
        logger.info(f"Resuming download for {dataset_name} (re-downloading)")
        return self.download_dataset(dataset_id, dataset_name, destination)
    
    def verify_download(self, local_path: Path, expected_size: int | None = None) -> bool:
        """
        Verify that a downloaded file or folder is complete.
        
        Args:
            local_path: Path to the downloaded file/folder
            expected_size: Expected size in bytes (for files only)
            
        Returns:
            bool: True if verification successful, False otherwise
        """
        try:
            if not local_path.exists():
                logger.error(f"Download verification failed: {local_path} does not exist")
                return False
            
            if local_path.is_file():
                actual_size = local_path.stat().st_size
                if expected_size and actual_size != expected_size:
                    logger.error(f"Size mismatch: expected {expected_size}, got {actual_size}")
                    return False
                logger.info(f"File verification successful: {local_path}")
                return True
            
            elif local_path.is_dir():
                # For directories, just check if they contain files
                file_count = len(list(local_path.rglob("*")))
                if file_count == 0:
                    logger.warning(f"Directory appears empty: {local_path}")
                    return False
                logger.info(f"Directory verification successful: {local_path} ({file_count} items)")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error verifying download: {e}")
            return False
    
    def cleanup_temp_files(self):
        """Clean up temporary download files."""
        try:
            if self.temp_path.exists():
                shutil.rmtree(self.temp_path)
                self.temp_path.mkdir(exist_ok=True)
                logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp files: {e}")
    
    def get_download_progress(self, dataset_name: str) -> dict[str, Any]:
        """
        Get download progress for a dataset (placeholder for future implementation).
        
        Args:
            dataset_name: Name of the dataset
            
        Returns:
            Dictionary with progress information
        """
        # This would be implemented with a proper progress tracking system
        return {
            "dataset_name": dataset_name,
            "status": "unknown",
            "progress": 0.0,
            "bytes_downloaded": 0,
            "total_bytes": 0,
            "eta": None
        }
