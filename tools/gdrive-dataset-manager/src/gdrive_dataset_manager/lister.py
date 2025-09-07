"""
Dataset listing functionality for Google Drive.
"""

import logging
from typing import Any
from datetime import datetime
from pathlib import Path

from googleapiclient.errors import HttpError
from rich.console import Console
from rich.table import Table
from rich.text import Text

from .auth import DriveAuthenticator

logger = logging.getLogger(__name__)
console = Console()

class DatasetLister:
    """Handles listing datasets on Google Drive."""
    
    def __init__(self, authenticator: DriveAuthenticator, folder_id: str):
        """
        Initialize the dataset lister.
        
        Args:
            authenticator: Authenticated DriveAuthenticator instance
            folder_id: Google Drive folder ID containing datasets
        """
        self.authenticator = authenticator
        self.folder_id = folder_id
        self.service = authenticator.get_service()
    
    def list_datasets(self, show_details: bool = False) -> list[dict[str, Any]]:
        """
        List all datasets in the configured Google Drive folder.
        
        Args:
            show_details: Include detailed metadata in output
            
        Returns:
            List of dataset information dictionaries
        """
        try:
            # Query for files in the specified folder
            query = f"'{self.folder_id}' in parents and trashed=false"
            fields = "nextPageToken, files(id, name, size, modifiedTime, mimeType, description)"
            
            results = self.service.files().list(
                q=query,
                fields=fields,
                pageSize=1000  # Adjust as needed
            ).execute()
            
            files = results.get('files', [])
            datasets = []
            
            for file in files:
                dataset_info = self._process_file_info(file, show_details)
                if dataset_info:
                    datasets.append(dataset_info)
            
            # Sort by modification time (newest first)
            datasets.sort(key=lambda x: x.get('modified_time', ''), reverse=True)
            
            logger.info(f"Found {len(datasets)} datasets")
            return datasets
            
        except HttpError as e:
            logger.error(f"HTTP error listing datasets: {e}")
            return []
        except Exception as e:
            logger.error(f"Error listing datasets: {e}")
            return []
    
    def _process_file_info(self, file: dict[str, Any], include_details: bool) -> dict[str, Any] | None:
        """
        Process individual file information.
        
        Args:
            file: File metadata from Google Drive API
            include_details: Whether to include detailed information
            
        Returns:
            Processed dataset information dictionary
        """
        try:
            dataset_info = {
                'id': file['id'],
                'name': file['name'],
                'size': self._format_size(int(file.get('size', 0))),
                'size_bytes': int(file.get('size', 0)),
                'modified_time': file.get('modifiedTime', ''),
                'mime_type': file.get('mimeType', ''),
                'is_folder': file.get('mimeType') == 'application/vnd.google-apps.folder'
            }
            
            # Format modification time
            if dataset_info['modified_time']:
                try:
                    dt = datetime.fromisoformat(dataset_info['modified_time'].replace('Z', '+00:00'))
                    dataset_info['modified_time_formatted'] = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    dataset_info['modified_time_formatted'] = dataset_info['modified_time']
            else:
                dataset_info['modified_time_formatted'] = 'Unknown'
            
            if include_details:
                dataset_info['description'] = file.get('description', '')
                dataset_info['type'] = self._determine_dataset_type(file['name'])
            
            return dataset_info
            
        except Exception as e:
            logger.warning(f"Error processing file {file.get('name', 'unknown')}: {e}")
            return None
    
    def _format_size(self, size_bytes: int) -> str:
        """
        Format file size in human-readable format.
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Formatted size string
        """
        if size_bytes == 0:
            return "0 B"
        
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        
        return f"{size_bytes:.1f} PB"
    
    def _determine_dataset_type(self, filename: str) -> str:
        """
        Determine dataset type based on filename patterns.
        
        Args:
            filename: Name of the dataset file/folder
            
        Returns:
            Dataset type string
        """
        filename_lower = filename.lower()
        
        if any(term in filename_lower for term in ['mental', 'therapy', 'counseling', 'psych']):
            return 'Mental Health'
        elif any(term in filename_lower for term in ['emotion', 'sentiment', 'feeling']):
            return 'Emotion'
        elif any(term in filename_lower for term in ['conversation', 'chat', 'dialogue']):
            return 'Conversation'
        elif any(term in filename_lower for term in ['cot', 'reasoning', 'thinking']):
            return 'Reasoning'
        elif any(term in filename_lower for term in ['reddit', 'social']):
            return 'Social Media'
        elif filename_lower.endswith(('.csv', '.json', '.jsonl')):
            return 'Structured Data'
        elif any(term in filename_lower for term in ['processed', 'clean', 'filtered']):
            return 'Processed'
        else:
            return 'Other'
    
    def display_datasets(self, datasets: list[dict[str, Any]], show_details: bool = False):
        """
        Display datasets in a formatted table.
        
        Args:
            datasets: List of dataset information dictionaries
            show_details: Whether to show detailed information
        """
        if not datasets:
            console.print("[yellow]No datasets found.[/yellow]")
            return
        
        table = Table(title="Available Datasets")
        
        # Add columns
        table.add_column("Name", style="cyan", no_wrap=False)
        table.add_column("Type", style="green", justify="center")
        table.add_column("Size", style="magenta", justify="right")
        table.add_column("Modified", style="yellow", justify="center")
        
        if show_details:
            table.add_column("ID", style="dim", no_wrap=True)
            table.add_column("Description", style="white", no_wrap=False)
        
        # Add rows
        for dataset in datasets:
            row_data = [
                dataset['name'],
                dataset.get('type', 'Unknown'),
                dataset['size'],
                dataset['modified_time_formatted']
            ]
            
            if show_details:
                row_data.extend([
                    dataset['id'][:12] + "...",  # Truncate ID
                    dataset.get('description', '')[:50] + "..." if len(dataset.get('description', '')) > 50 else dataset.get('description', '')
                ])
            
            # Color code by type
            if dataset.get('is_folder'):
                row_data[0] = f"📁 {row_data[0]}"
            
            table.add_row(*row_data)
        
        console.print(table)
        console.print(f"\n[green]Total: {len(datasets)} datasets[/green]")
    
    def search_datasets(self, query: str) -> list[dict[str, Any]]:
        """
        Search for datasets by name or content.
        
        Args:
            query: Search query string
            
        Returns:
            List of matching dataset information dictionaries
        """
        try:
            # Build search query
            search_query = f"'{self.folder_id}' in parents and trashed=false and name contains '{query}'"
            fields = "nextPageToken, files(id, name, size, modifiedTime, mimeType, description)"
            
            results = self.service.files().list(
                q=search_query,
                fields=fields,
                pageSize=1000
            ).execute()
            
            files = results.get('files', [])
            datasets = []
            
            for file in files:
                dataset_info = self._process_file_info(file, True)
                if dataset_info:
                    datasets.append(dataset_info)
            
            logger.info(f"Found {len(datasets)} datasets matching '{query}'")
            return datasets
            
        except HttpError as e:
            logger.error(f"HTTP error searching datasets: {e}")
            return []
        except Exception as e:
            logger.error(f"Error searching datasets: {e}")
            return []
    
    def get_dataset_info(self, dataset_id: str) -> dict[str, Any] | None:
        """
        Get detailed information about a specific dataset.
        
        Args:
            dataset_id: Google Drive file/folder ID
            
        Returns:
            Dataset information dictionary or None if not found
        """
        try:
            file = self.service.files().get(
                fileId=dataset_id,
                fields="id, name, size, modifiedTime, createdTime, mimeType, description, parents, owners"
            ).execute()
            
            return self._process_file_info(file, True)
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"Dataset not found: {dataset_id}")
            else:
                logger.error(f"HTTP error getting dataset info: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting dataset info: {e}")
            return None
