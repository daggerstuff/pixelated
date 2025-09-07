"""
Google Drive authentication module for dataset management.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Google Drive API scopes
SCOPES = ['https://www.googleapis.com/auth/drive']

class DriveAuthenticator:
    """Handles Google Drive API authentication."""
    
    def __init__(self, credentials_file: str, token_file: str = "token.json"):
        """
        Initialize the authenticator.
        
        Args:
            credentials_file: Path to Google API credentials JSON file
            token_file: Path to store authentication token
        """
        self.credentials_file = Path(credentials_file)
        self.token_file = Path(token_file)
        self._service = None
        self._creds = None
        
    def authenticate(self) -> bool:
        """
        Authenticate with Google Drive API.
        
        Returns:
            bool: True if authentication successful, False otherwise
        """
        try:
            self._creds = self._get_credentials()
            if not self._creds or not self._creds.valid:
                logger.error("Failed to obtain valid credentials")
                return False
                
            self._service = build('drive', 'v3', credentials=self._creds)
            logger.info("Successfully authenticated with Google Drive API")
            return True
            
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return False
    
    def _get_credentials(self) -> Optional[Credentials]:
        """
        Get or refresh Google API credentials.
        
        Returns:
            Credentials object if successful, None otherwise
        """
        creds = None
        
        # Load existing token if available
        if self.token_file.exists():
            try:
                creds = Credentials.from_authorized_user_file(str(self.token_file), SCOPES)
                logger.debug(f"Loaded existing token from {self.token_file}")
            except Exception as e:
                logger.warning(f"Failed to load existing token: {e}")
        
        # Refresh or obtain new credentials
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    logger.debug("Refreshed existing credentials")
                except Exception as e:
                    logger.warning(f"Failed to refresh credentials: {e}")
                    creds = None
            
            if not creds:
                creds = self._obtain_new_credentials()
        
        # Save credentials for next run
        if creds and creds.valid:
            try:
                with open(self.token_file, 'w') as token:
                    token.write(creds.to_json())
                logger.debug(f"Saved credentials to {self.token_file}")
            except Exception as e:
                logger.warning(f"Failed to save credentials: {e}")
        
        return creds
    
    def _obtain_new_credentials(self) -> Optional[Credentials]:
        """
        Obtain new credentials through OAuth flow.
        
        Returns:
            Credentials object if successful, None otherwise
        """
        if not self.credentials_file.exists():
            logger.error(f"Credentials file not found: {self.credentials_file}")
            return None
        
        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(self.credentials_file), SCOPES
            )
            creds = flow.run_local_server(port=0)
            logger.info("Obtained new credentials through OAuth flow")
            return creds
            
        except Exception as e:
            logger.error(f"Failed to obtain new credentials: {e}")
            return None
    
    def get_service(self):
        """
        Get the Google Drive service object.
        
        Returns:
            Google Drive service object
        
        Raises:
            RuntimeError: If not authenticated
        """
        if not self._service:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        return self._service
    
    def test_connection(self) -> bool:
        """
        Test the connection to Google Drive API.
        
        Returns:
            bool: True if connection is working, False otherwise
        """
        try:
            service = self.get_service()
            # Try to get user info
            about = service.about().get(fields="user").execute()
            user_email = about.get('user', {}).get('emailAddress', 'Unknown')
            logger.info(f"Connection test successful. Authenticated as: {user_email}")
            return True
            
        except HttpError as e:
            logger.error(f"Connection test failed with HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def revoke_authentication(self) -> bool:
        """
        Revoke authentication and remove stored token.
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if self.token_file.exists():
                self.token_file.unlink()
                logger.info("Removed stored authentication token")
            
            self._service = None
            self._creds = None
            return True
            
        except Exception as e:
            logger.error(f"Failed to revoke authentication: {e}")
            return False
