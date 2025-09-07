"""
Dataset upload functionality for Google Drive.
"""

import logging
import shutil
import zipfile
from pathlib import Path
from typing import Any

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from rich.console import Console
from rich.progress import (
    Progress,
    BarColumn,
    TextColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
    SpinnerColumn,
)

from .auth import DriveAuthenticator

logger = logging.getLogger(__name__)
console = Console()


class DatasetUploader:
    """Handles uploading datasets to Google Drive."""

    def __init__(self, authenticator: DriveAuthenticator, config: dict[str, Any]):
        """
        Initialize the dataset uploader.

        Args:
            authenticator: Authenticated DriveAuthenticator instance
            config: Configuration dictionary containing upload settings
        """
        self.authenticator = authenticator
        self.config = config
        self.service = authenticator.get_service()
        self.folder_id = config["google_drive"]["folder_id"]

        # Create temp directory for compression
        self.temp_path = Path(config["local"]["temp_path"])
        self.temp_path.mkdir(parents=True, exist_ok=True)

    def upload_dataset(
        self, local_path: str | Path, dataset_name: str | None = None, compress: bool | None = None
    ) -> dict[str, Any] | None:
        """
        Upload a dataset to Google Drive.

        Args:
            local_path: Path to local dataset file or directory
            dataset_name: Optional custom name for the uploaded dataset
            compress: Whether to compress before upload (overrides config)

        Returns:
            Dictionary with upload result info or None if failed
        """
        try:
            local_path = Path(local_path)
            if not local_path.exists():
                logger.error(f"Local path does not exist: {local_path}")
                return None

            # Determine if we should compress
            should_compress = (
                compress if compress is not None else self.config["upload"]["compress"]
            )

            # Prepare the file for upload
            if local_path.is_dir() and should_compress:
                upload_path = self._compress_directory(local_path, dataset_name)
                if not upload_path:
                    return None
                is_compressed = True
            elif (
                local_path.is_file()
                and should_compress
                and not local_path.suffix.lower() in [".zip", ".tar", ".gz"]
            ):
                upload_path = self._compress_file(local_path, dataset_name)
                if not upload_path:
                    return None
                is_compressed = True
            else:
                upload_path = local_path
                is_compressed = False

            # Check file size
            file_size = upload_path.stat().st_size
            max_size = self.config["upload"]["max_file_size"]
            if file_size > max_size:
                logger.error(f"File too large: {file_size} bytes > {max_size} bytes")
                if is_compressed and upload_path != local_path:
                    upload_path.unlink()  # Clean up temp file
                return None

            # Determine final name
            final_name = dataset_name or upload_path.name

            # Upload the file
            result = self._upload_file(upload_path, final_name, file_size)

            # Clean up compressed file if created
            if is_compressed and upload_path != local_path:
                upload_path.unlink()

            return result

        except Exception as e:
            logger.error(f"Error uploading dataset: {e}")
            return None

    def _compress_directory(self, dir_path: Path, custom_name: str | None = None) -> Path | None:
        """
        Compress a directory into a ZIP file.

        Args:
            dir_path: Path to directory to compress
            custom_name: Optional custom name for the compressed file

        Returns:
            Path to compressed file or None if failed
        """
        try:
            zip_name = custom_name or f"{dir_path.name}.zip"
            if not zip_name.endswith(".zip"):
                zip_name += ".zip"

            zip_path = self.temp_path / zip_name

            console.print(f"[yellow]Compressing directory: {dir_path.name}[/yellow]")

            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_path in dir_path.rglob("*"):
                    if file_path.is_file():
                        arcname = file_path.relative_to(dir_path.parent)
                        zipf.write(file_path, arcname)

            logger.info(f"Compressed {dir_path} to {zip_path}")
            return zip_path

        except Exception as e:
            logger.error(f"Error compressing directory: {e}")
            return None

    def _compress_file(self, file_path: Path, custom_name: str | None = None) -> Path | None:
        """
        Compress a single file into a ZIP archive.

        Args:
            file_path: Path to file to compress
            custom_name: Optional custom name for the compressed file

        Returns:
            Path to compressed file or None if failed
        """
        try:
            zip_name = custom_name or f"{file_path.stem}.zip"
            if not zip_name.endswith(".zip"):
                zip_name += ".zip"

            zip_path = self.temp_path / zip_name

            console.print(f"[yellow]Compressing file: {file_path.name}[/yellow]")

            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(file_path, file_path.name)

            logger.info(f"Compressed {file_path} to {zip_path}")
            return zip_path

        except Exception as e:
            logger.error(f"Error compressing file: {e}")
            return None

    def _upload_file(self, file_path: Path, filename: str, file_size: int) -> dict[str, Any] | None:
        """
        Upload a file to Google Drive.

        Args:
            file_path: Path to file to upload
            filename: Name for the file on Google Drive
            file_size: Size of the file in bytes

        Returns:
            Dictionary with upload result info or None if failed
        """
        try:
            # Create media upload object
            chunk_size = self.config["upload"]["chunk_size"]
            media = MediaFileUpload(str(file_path), resumable=True, chunksize=chunk_size)

            # File metadata
            file_metadata = {"name": filename, "parents": [self.folder_id]}

            # Create upload request
            request = self.service.files().create(
                body=file_metadata, media_body=media, fields="id,name,size,webViewLink"
            )

            # Upload with progress tracking
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TransferSpeedColumn(),
                TimeRemainingColumn(),
                console=console,
            ) as progress:
                task_id = progress.add_task(description=f"Uploading {filename}", total=file_size)

                response = None
                while response is None:
                    status, response = request.next_chunk()
                    if status:
                        progress.update(task_id, completed=int(status.progress() * file_size))

            # Process response
            uploaded_file = response
            result = {
                "id": uploaded_file["id"],
                "name": uploaded_file["name"],
                "size": uploaded_file.get("size", file_size),
                "web_view_link": uploaded_file.get("webViewLink"),
                "local_path": str(file_path),
                "compressed": file_path.suffix.lower() == ".zip",
            }

            logger.info(f"Successfully uploaded: {filename} (ID: {result['id']})")
            console.print(f"[green]✓ Upload complete: {filename}[/green]")
            console.print(f"[dim]View at: {result['web_view_link']}[/dim]")

            return result

        except HttpError as e:
            logger.error(f"HTTP error uploading file: {e}")
            return None
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            return None

    def upload_multiple_datasets(
        self, dataset_paths: list[dict[str, Any]]
    ) -> dict[str, dict[str, Any] | None]:
        """
        Upload multiple datasets.

        Args:
            dataset_paths: List of dictionaries with 'path', optional 'name', and 'compress'

        Returns:
            Dictionary mapping dataset paths to upload results
        """
        results = {}

        console.print(f"[cyan]Starting upload of {len(dataset_paths)} datasets...[/cyan]")

        for dataset_spec in dataset_paths:
            local_path = dataset_spec["path"]
            dataset_name = dataset_spec.get("name")
            compress = dataset_spec.get("compress")

            console.print(f"\n[yellow]Processing: {Path(local_path).name}[/yellow]")

            result = self.upload_dataset(local_path, dataset_name, compress)
            results[local_path] = result

            if result:
                console.print(f"[green]✓ {Path(local_path).name} uploaded successfully[/green]")
            else:
                console.print(f"[red]✗ {Path(local_path).name} upload failed[/red]")

        # Summary
        successful = sum(1 for result in results.values() if result is not None)
        console.print(
            f"\n[cyan]Upload Summary: {successful}/{len(dataset_paths)} successful[/cyan]"
        )

        return results

    def create_folder(
        self, folder_name: str, parent_folder_id: str | None = None
    ) -> dict[str, Any] | None:
        """
        Create a new folder on Google Drive.

        Args:
            folder_name: Name of the folder to create
            parent_folder_id: ID of parent folder (defaults to configured folder)

        Returns:
            Dictionary with folder info or None if failed
        """
        try:
            parent_id = parent_folder_id or self.folder_id

            file_metadata = {
                "name": folder_name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_id],
            }

            folder = (
                self.service.files()
                .create(body=file_metadata, fields="id,name,webViewLink")
                .execute()
            )

            logger.info(f"Created folder: {folder_name} (ID: {folder['id']})")
            console.print(f"[green]Created folder: {folder_name}[/green]")

            return {
                "id": folder["id"],
                "name": folder["name"],
                "web_view_link": folder.get("webViewLink"),
                "type": "folder",
            }

        except HttpError as e:
            logger.error(f"HTTP error creating folder: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating folder: {e}")
            return None

    def upload_to_folder(
        self, local_path: str | Path, folder_name: str, dataset_name: str | None = None
    ) -> dict[str, Any] | None:
        """
        Upload a dataset to a specific folder, creating the folder if needed.

        Args:
            local_path: Path to local dataset
            folder_name: Name of the target folder
            dataset_name: Optional custom name for the dataset

        Returns:
            Dictionary with upload result or None if failed
        """
        try:
            # Check if folder exists
            folder_id = self._find_folder(folder_name)

            # Create folder if it doesn't exist
            if not folder_id:
                folder_result = self.create_folder(folder_name)
                if not folder_result:
                    logger.error(f"Failed to create folder: {folder_name}")
                    return None
                folder_id = folder_result["id"]

            # Temporarily update config to use the target folder
            original_folder_id = self.folder_id
            self.folder_id = folder_id

            try:
                result = self.upload_dataset(local_path, dataset_name)
                if result:
                    result["folder"] = folder_name
                    result["folder_id"] = folder_id
                return result
            finally:
                # Restore original folder ID
                self.folder_id = original_folder_id

        except Exception as e:
            logger.error(f"Error uploading to folder: {e}")
            return None

    def _find_folder(self, folder_name: str) -> str | None:
        """
        Find a folder by name in the configured parent directory.

        Args:
            folder_name: Name of the folder to find

        Returns:
            Folder ID if found, None otherwise
        """
        try:
            query = f"'{self.folder_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"

            results = self.service.files().list(q=query, fields="files(id, name)").execute()

            files = results.get("files", [])
            if files:
                return files[0]["id"]
            return None

        except Exception as e:
            logger.error(f"Error finding folder: {e}")
            return None

    def get_upload_quota(self) -> dict[str, Any]:
        """
        Get Google Drive storage quota information.

        Returns:
            Dictionary with quota information
        """
        try:
            about = self.service.about().get(fields="storageQuota").execute()
            quota = about.get("storageQuota", {})

            total = int(quota.get("limit", 0))
            used = int(quota.get("usage", 0))
            available = total - used if total > 0 else float("inf")

            return {
                "total_bytes": total,
                "used_bytes": used,
                "available_bytes": available,
                "usage_percentage": (used / total * 100) if total > 0 else 0,
            }

        except Exception as e:
            logger.error(f"Error getting quota info: {e}")
            return {"total_bytes": 0, "used_bytes": 0, "available_bytes": 0, "usage_percentage": 0}

    def cleanup_temp_files(self):
        """Clean up temporary upload files."""
        try:
            if self.temp_path.exists():
                shutil.rmtree(self.temp_path)
                self.temp_path.mkdir(exist_ok=True)
                logger.info("Cleaned up temporary upload files")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp files: {e}")
