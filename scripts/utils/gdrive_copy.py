#!/usr/bin/env python3
"""
Copy a file from one Google Drive to another without local download.

This script uses the Google Drive API to copy files directly between
Google Drive accounts without downloading to local storage.

Usage:
    python scripts/utils/gdrive_copy.py <source_file_id> [--destination-folder-id <folder_id>]

Example:
    python scripts/utils/gdrive_copy.py 1eLzYK2cPQUZqOqtpGLBNLmwMRtJoQPJr
"""

import argparse
import logging
import sys
import traceback
from pathlib import Path

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    logging.basicConfig(level=logging.ERROR, format="%(message)s")
    logger = logging.getLogger(__name__)
    logger.error(
        "Error: Google API libraries not installed. Run: uv pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
    )
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Scopes required for Drive API
SCOPES = ["https://www.googleapis.com/auth/drive"]

# Token storage location
TOKEN_DIR = Path.home() / ".config" / "gdrive_copy"
TOKEN_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_TOKEN_FILE = TOKEN_DIR / "source_token.json"
DEST_TOKEN_FILE = TOKEN_DIR / "dest_token.json"

# Credentials file location (user needs to download from Google Cloud Console)
CREDENTIALS_FILE = TOKEN_DIR / "credentials.json"


def get_credentials(token_file: Path, account_name: str) -> Credentials | None:
    """Get valid user credentials from storage or OAuth flow."""
    creds = None

    # Load existing token
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                show_credentials_setup_instructions()
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            logger.info(f"\n🔐 Authenticating {account_name} account...")
            logger.info("   Please complete the OAuth flow in your browser.")
            creds = flow.run_local_server(port=0)

        # Save credentials for next run
        with open(token_file, "w") as token:
            token.write(creds.to_json())

    return creds


def show_credentials_setup_instructions() -> None:
    """Display instructions for setting up Google Drive API credentials."""
    logger.error(f"\n❌ Credentials file not found: {CREDENTIALS_FILE}")
    logger.info("\n📋 Setup Instructions:")
    logger.info("1. Go to https://console.cloud.google.com/")
    logger.info("2. Create a new project or select existing")
    logger.info("3. Enable Google Drive API")
    logger.info("4. Create OAuth 2.0 credentials (Desktop app)")
    logger.info("5. Download credentials.json")
    logger.info(f"6. Save it as: {CREDENTIALS_FILE}")
    sys.exit(1)


def get_drive_service(token_file: Path, account_name: str):
    """Build and return a Drive API service object."""
    creds = get_credentials(token_file, account_name)
    return build("drive", "v3", credentials=creds)


def authenticate_services(source_account: str, dest_account: str):
    """Authenticate and return both source and destination Drive services."""
    logger.info("\n🔑 Authenticating source account...")
    source_service = get_drive_service(SOURCE_TOKEN_FILE, source_account)

    logger.info("\n🔑 Authenticating destination account...")
    dest_service = get_drive_service(DEST_TOKEN_FILE, dest_account)

    return source_service, dest_service


def extract_file_id(url: str) -> str:
    """Extract file ID from Google Drive URL."""
    if "/file/d/" in url:
        return url.split("/file/d/")[1].split("/")[0]
    return url.split("id=")[1].split("&")[0] if "id=" in url else url


def get_file_metadata(source_service, source_file_id: str) -> dict:
    """Fetch file metadata from source Drive."""
    logger.info("\n📄 Fetching file metadata from source Drive...")
    source_file = (
        source_service.files().get(fileId=source_file_id, fields="id,name,mimeType,size").execute()
    )

    file_name = source_file.get("name", "Unknown")
    file_size = source_file.get("size", "Unknown")
    logger.info(f"   File: {file_name}")
    logger.info(f"   Size: {file_size} bytes" if file_size != "Unknown" else "   Size: Unknown")
    return source_file


def prepare_copy_metadata(file_name: str, destination_folder_id: str | None = None) -> dict:
    """Prepare metadata for copying a file to destination Drive."""
    copy_metadata = {"name": file_name}
    if destination_folder_id is not None:
        copy_metadata["parents"] = destination_folder_id
    return copy_metadata


def copy_file(
    source_service,
    dest_service,
    source_file_id: str,
    destination_folder_id: str | None = None,
) -> str:
    """
    Copy a file from source Drive to destination Drive.

    Returns the ID of the copied file.
    """
    try:
        return _execute_file_copy(
            source_service, source_file_id, destination_folder_id, dest_service
        )
    except HttpError as error:
        logger.error(f"\n❌ Error copying file: {error}")
        if error.resp.status == 404:
            logger.error("   File not found. Check the source file ID and permissions.")
        elif error.resp.status == 403:
            logger.error("   Permission denied. Ensure both accounts have access.")
        raise


def _execute_file_copy(
    source_service,
    source_file_id: str,
    destination_folder_id: str | None,
    dest_service,
) -> str:
    """Execute the file copy operation and return the new file ID."""
    source_file = get_file_metadata(source_service, source_file_id)
    file_name = source_file.get("name", "Unknown")
    copy_metadata = prepare_copy_metadata(file_name, destination_folder_id)

    # Copy file to destination Drive
    logger.info("\n📋 Copying file to destination Drive...")
    copied_file = dest_service.files().copy(fileId=source_file_id, body=copy_metadata).execute()

    new_file_id = copied_file.get("id")
    new_file_name = copied_file.get("name")
    logger.info("✅ Successfully copied!")
    logger.info(f"   New file ID: {new_file_id}")
    logger.info(f"   New file name: {new_file_name}")
    logger.info(f"   View: https://drive.google.com/file/d/{new_file_id}/view")

    return new_file_id


def main():
    parser = argparse.ArgumentParser(
        description="Copy files between Google Drive accounts without local download"
    )
    parser.add_argument(
        "source_file",
        help="Source file ID or Google Drive URL",
    )
    parser.add_argument(
        "--destination-folder-id",
        help="Optional: Destination folder ID in target Drive",
    )
    parser.add_argument(
        "--source-account",
        default="Source",
        help="Name for source account (for display)",
    )
    parser.add_argument(
        "--dest-account",
        default="Destination",
        help="Name for destination account (for display)",
    )

    args = parser.parse_args()

    # Extract file ID from URL if needed
    source_file_id = extract_file_id(args.source_file)

    logger.info("🚀 Google Drive Direct Copy Tool")
    logger.info("=" * 50)
    logger.info(f"Source File ID: {source_file_id}")

    try:
        source_service, dest_service = authenticate_services(args.source_account, args.dest_account)

        # Copy the file
        new_file_id = copy_file(
            source_service,
            dest_service,
            source_file_id,
            args.destination_folder_id,
        )

        logger.info(f"\n✨ Copy completed successfully! New file ID: {new_file_id}")
        return 0

    except KeyboardInterrupt:
        logger.warning("\n\n⚠️  Operation cancelled by user.")
        return 1
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
