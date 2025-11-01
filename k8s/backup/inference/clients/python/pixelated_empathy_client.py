#!/usr/bin/env python3
"""
Pixelated Empathy AI - Official Python Client Library
Task 3A.3.2: Complete Python Client Library

Enterprise-grade Python SDK for accessing the Pixelated Empathy AI API.
Provides async/sync support, comprehensive error handling, and retry mechanisms.
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any, Union, AsyncGenerator, Generator
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import requests
from urllib.parse import urljoin
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QualityTier(Enum):
    """Available data quality tiers."""
    RESEARCH = "research"
    CLINICAL = "clinical" 
    PROFESSIONAL = "professional"
    STANDARD = "standard"
    BASIC = "basic"


class ExportFormat(Enum):
    """Available export formats."""
    JSONL = "jsonl"
    PARQUET = "parquet"
    CSV = "csv"
    HUGGINGFACE = "huggingface"
    OPENAI = "openai"


class JobStatus(Enum):
    """Export job statuses."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AdvancedQuery:
    """Advanced query parameters for conversation filtering."""
    dataset: Optional[str] = None
    tier: Optional[str] = None
    min_quality: Optional[float] = None
    max_quality: Optional[float] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    min_messages: Optional[int] = None
    max_messages: Optional[int] = None
    content_search: Optional[str] = None
    role_filter: Optional[str] = None
    min_therapeutic_accuracy: Optional[float] = None
    min_emotional_authenticity: Optional[float] = None
    min_safety_score: Optional[float] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"
    limit: int = 100
    offset: int = 0


@dataclass
class BulkExportRequest:
    """Bulk export request configuration."""
    dataset: str
    format: ExportFormat = ExportFormat.JSONL
    filters: Optional[AdvancedQuery] = None
    include_metadata: bool = True
    include_quality_metrics: bool = True
    batch_size: int = 1000
    notify_email: Optional[str] = None
    callback_url: Optional[str] = None


class PixelatedEmpathyError(Exception):
    """Base exception for Pixelated Empathy API errors."""
    
    def __init__(self, message: str, status_code: int = None, response_data: Dict = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data or {}
        super().__init__(self.message)


class RateLimitError(PixelatedEmpathyError):
    """Rate limit exceeded error."""
    
    def __init__(self, message: str, retry_after: int = None, **kwargs):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class AuthenticationError(PixelatedEmpathyError):
    """Authentication failed error."""
    pass


class PixelatedEmpathyClient:
    """
    Async/Sync Python client for Pixelated Empathy AI API.
    
    Features:
    - Async and sync method support
    - Automatic retry with exponential backoff
    - Rate limit handling
    - Comprehensive error handling
    - Request/response logging
    - Connection pooling
    
    Example:
    ```python
    # Async usage
    async with PixelatedEmpathyClient("your-api-key") as client:
        datasets = await client.list_datasets()
        conversations = await client.query_conversations(
            AdvancedQuery(tier="professional", min_quality=0.8)
        )
    
    # Sync usage
    client = PixelatedEmpathyClient("your-api-key")
    datasets = client.list_datasets_sync()
    client.close()
    ```
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.pixelated-empathy.ai",
        timeout: int = 30,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
        enable_logging: bool = True,
    ):
        """
        Initialize the Pixelated Empathy AI client.
        
        Args:
            api_key: Your API authentication key
            base_url: Base URL for the API (default: production)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            retry_backoff: Base delay for exponential backoff
            enable_logging: Enable request/response logging
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.enable_logging = enable_logging
        
        # Headers for all requests
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "pixelated-empathy-python-client/1.0.0",
        }
        
        # Session for sync requests
        self._sync_session = None
        self._async_session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._create_async_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def _create_async_session(self):
        """Create async HTTP session."""
        if self._async_session is None:
            connector = aiohttp.TCPConnector(limit=100)
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._async_session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers=self.headers
            )
    
    def _create_sync_session(self):
        """Create sync HTTP session."""
        if self._sync_session is None:
            self._sync_session = requests.Session()
            self._sync_session.headers.update(self.headers)
    
    async def close(self):
        """Close async session."""
        if self._async_session:
            await self._async_session.close()
            self._async_session = None
        if self._sync_session:
            self._sync_session.close()
            self._sync_session = None
    
    def _log_request(self, method: str, url: str, **kwargs):
        """Log request details."""
        if self.enable_logging:
            logger.info(f"API Request: {method} {url}")
    
    def _log_response(self, method: str, url: str, status_code: int, response_time: float):
        """Log response details."""
        if self.enable_logging:
            logger.info(f"API Response: {method} {url} -> {status_code} ({response_time:.3f}s)")
    
    def _handle_error_response(self, response_data: Dict, status_code: int):
        """Handle API error responses."""
        error_message = response_data.get("message", "Unknown API error")
        
        if status_code == 401:
            raise AuthenticationError(error_message, status_code, response_data)
        elif status_code == 429:
            retry_after = response_data.get("rate_limit_info", {}).get("retry_after")
            raise RateLimitError(error_message, retry_after, status_code, response_data)
        else:
            raise PixelatedEmpathyError(error_message, status_code, response_data)
    
    async def _async_request_with_retry(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make async request with retry logic."""
        await self._create_async_session()
        url = urljoin(self.base_url, endpoint)
        
        for attempt in range(self.max_retries + 1):
            try:
                start_time = time.time()
                self._log_request(method, url, **kwargs)
                
                async with self._async_session.request(method, url, **kwargs) as response:
                    response_time = time.time() - start_time
                    response_data = await response.json()
                    
                    self._log_response(method, url, response.status, response_time)
                    
                    if response.status >= 400:
                        if response.status == 429 and attempt < self.max_retries:
                            # Handle rate limiting with backoff
                            retry_after = response_data.get("rate_limit_info", {}).get("retry_after", 60)
                            await asyncio.sleep(min(retry_after, 300))  # Max 5 minutes
                            continue
                        
                        self._handle_error_response(response_data, response.status)
                    
                    return response_data
                    
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt < self.max_retries:
                    delay = self.retry_backoff * (2 ** attempt)
                    logger.warning(f"Request failed (attempt {attempt + 1}), retrying in {delay}s: {e}")
                    await asyncio.sleep(delay)
                    continue
                raise PixelatedEmpathyError(f"Request failed after {self.max_retries} retries: {e}")
        
        raise PixelatedEmpathyError("Maximum retries exceeded")
    
    def _sync_request_with_retry(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make sync request with retry logic."""
        self._create_sync_session()
        url = urljoin(self.base_url, endpoint)
        
        for attempt in range(self.max_retries + 1):
            try:
                start_time = time.time()
                self._log_request(method, url, **kwargs)
                
                response = self._sync_session.request(
                    method, url, timeout=self.timeout, **kwargs
                )
                
                response_time = time.time() - start_time
                response_data = response.json()
                
                self._log_response(method, url, response.status_code, response_time)
                
                if response.status_code >= 400:
                    if response.status_code == 429 and attempt < self.max_retries:
                        # Handle rate limiting with backoff
                        retry_after = response_data.get("rate_limit_info", {}).get("retry_after", 60)
                        time.sleep(min(retry_after, 300))  # Max 5 minutes
                        continue
                    
                    self._handle_error_response(response_data, response.status_code)
                
                return response_data
                
            except (requests.RequestException, requests.Timeout) as e:
                if attempt < self.max_retries:
                    delay = self.retry_backoff * (2 ** attempt)
                    logger.warning(f"Request failed (attempt {attempt + 1}), retrying in {delay}s: {e}")
                    time.sleep(delay)
                    continue
                raise PixelatedEmpathyError(f"Request failed after {self.max_retries} retries: {e}")
        
        raise PixelatedEmpathyError("Maximum retries exceeded")
    
    # ASYNC METHODS
    
    async def list_datasets(self) -> List[Dict]:
        """List all available datasets."""
        response = await self._async_request_with_retry("GET", "/v1/datasets")
        return response["data"]["datasets"]
    
    async def get_dataset_info(self, dataset_name: str) -> Dict:
        """Get detailed information about a specific dataset."""
        response = await self._async_request_with_retry("GET", f"/v1/datasets/{dataset_name}")
        return response["data"]
    
    async def query_conversations(self, query: AdvancedQuery) -> Dict:
        """Query conversations with advanced filtering."""
        query_dict = {k: v.isoformat() if isinstance(v, datetime) else v 
                     for k, v in asdict(query).items() if v is not None}
        
        response = await self._async_request_with_retry(
            "POST", "/v1/conversations/query", json=query_dict
        )
        return response["data"]
    
    async def get_conversation(self, conversation_id: str) -> Dict:
        """Get a specific conversation by ID."""
        response = await self._async_request_with_retry("GET", f"/v1/conversations/{conversation_id}")
        return response["data"]
    
    async def create_bulk_export(self, export_request: BulkExportRequest) -> str:
        """Create a bulk export job. Returns job_id."""
        export_dict = asdict(export_request)
        if export_dict["filters"]:
            filters = export_dict["filters"]
            # Convert datetime objects to ISO strings
            for key, value in filters.items():
                if isinstance(value, datetime):
                    filters[key] = value.isoformat()
        
        export_dict["format"] = export_request.format.value
        
        response = await self._async_request_with_retry(
            "POST", "/v1/export/bulk", json=export_dict
        )
        return response["data"]["job_id"]
    
    async def get_export_status(self, job_id: str) -> Dict:
        """Get status of a bulk export job."""
        response = await self._async_request_with_retry("GET", f"/v1/export/jobs/{job_id}/status")
        return response["data"]
    
    async def list_export_jobs(self, status: Optional[JobStatus] = None, limit: int = 50) -> List[Dict]:
        """List export jobs with optional status filtering."""
        params = {"limit": limit}
        if status:
            params["status"] = status.value
        
        response = await self._async_request_with_retry("GET", "/v1/export/jobs", params=params)
        return response["data"]["jobs"]
    
    async def cancel_export_job(self, job_id: str) -> Dict:
        """Cancel a running export job."""
        response = await self._async_request_with_retry("DELETE", f"/v1/export/jobs/{job_id}")
        return response["data"]
    
    async def get_usage_statistics(self) -> Dict:
        """Get comprehensive usage statistics."""
        response = await self._async_request_with_retry("GET", "/v1/monitoring/usage")
        return response["data"]
    
    async def get_rate_limit_info(self) -> Dict:
        """Get current rate limiting information."""
        response = await self._async_request_with_retry("GET", "/v1/monitoring/rate-limits")
        return response["data"]
    
    # SYNC METHODS (for backwards compatibility)
    
    def list_datasets_sync(self) -> List[Dict]:
        """Sync version of list_datasets."""
        response = self._sync_request_with_retry("GET", "/v1/datasets")
        return response["data"]["datasets"]
    
    def get_dataset_info_sync(self, dataset_name: str) -> Dict:
        """Sync version of get_dataset_info."""
        response = self._sync_request_with_retry("GET", f"/v1/datasets/{dataset_name}")
        return response["data"]
    
    def query_conversations_sync(self, query: AdvancedQuery) -> Dict:
        """Sync version of query_conversations."""
        query_dict = {k: v.isoformat() if isinstance(v, datetime) else v 
                     for k, v in asdict(query).items() if v is not None}
        
        response = self._sync_request_with_retry(
            "POST", "/v1/conversations/query", json=query_dict
        )
        return response["data"]
    
    def create_bulk_export_sync(self, export_request: BulkExportRequest) -> str:
        """Sync version of create_bulk_export."""
        export_dict = asdict(export_request)
        if export_dict["filters"]:
            filters = export_dict["filters"]
            for key, value in filters.items():
                if isinstance(value, datetime):
                    filters[key] = value.isoformat()
        
        export_dict["format"] = export_request.format.value
        
        response = self._sync_request_with_retry(
            "POST", "/v1/export/bulk", json=export_dict
        )
        return response["data"]["job_id"]
    
    # HELPER METHODS
    
    async def wait_for_export_completion(
        self, 
        job_id: str, 
        poll_interval: int = 30,
        timeout: int = 3600
    ) -> Dict:
        """
        Wait for export job to complete.
        
        Args:
            job_id: The export job ID
            poll_interval: How often to check status (seconds)
            timeout: Maximum time to wait (seconds)
            
        Returns:
            Final job status
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = await self.get_export_status(job_id)
            
            if status["status"] in [JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value]:
                return status
            
            logger.info(f"Export job {job_id}: {status['status']} ({status['progress']:.1f}%)")
            await asyncio.sleep(poll_interval)
        
        raise PixelatedEmpathyError(f"Export job {job_id} did not complete within {timeout} seconds")
    
    async def export_and_wait(
        self, 
        export_request: BulkExportRequest,
        poll_interval: int = 30,
        timeout: int = 3600
    ) -> Dict:
        """Create export job and wait for completion."""
        job_id = await self.create_bulk_export(export_request)
        return await self.wait_for_export_completion(job_id, poll_interval, timeout)


# Convenience functions for quick usage
async def quick_query(api_key: str, query: AdvancedQuery) -> Dict:
    """Quick async conversation query."""
    async with PixelatedEmpathyClient(api_key) as client:
        return await client.query_conversations(query)


async def quick_export(api_key: str, dataset: str, format: ExportFormat = ExportFormat.JSONL) -> str:
    """Quick async export job creation."""
    async with PixelatedEmpathyClient(api_key) as client:
        export_request = BulkExportRequest(dataset=dataset, format=format)
        return await client.create_bulk_export(export_request)


if __name__ == "__main__":
    # Example usage
    async def main():
        api_key = "your-api-key-here"
        
        async with PixelatedEmpathyClient(api_key) as client:
            # List available datasets
            datasets = await client.list_datasets()
            print(f"Available datasets: {[ds['name'] for ds in datasets]}")
            
            # Query professional-tier conversations
            query = AdvancedQuery(
                tier="professional",
                min_quality=0.8,
                limit=10
            )
            conversations = await client.query_conversations(query)
            print(f"Found {len(conversations['conversations'])} conversations")
            
            # Create export job
            export_request = BulkExportRequest(
                dataset="priority_complete_fixed",
                format=ExportFormat.JSONL,
                filters=query
            )
            job_id = await client.create_bulk_export(export_request)
            print(f"Created export job: {job_id}")
            
            # Check usage statistics
            usage = await client.get_usage_statistics()
            print(f"API usage: {usage['user_statistics']['total_requests']} requests")
    
    # Run example (uncomment to test)
    # asyncio.run(main())