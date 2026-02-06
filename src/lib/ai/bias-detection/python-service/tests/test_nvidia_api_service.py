"""
Tests for NVIDIA API service
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from bias_detection.services.nvidia_api_service import NvidiaAPIService, kimi_chat_completion


class TestNvidiaAPIService(unittest.TestCase):
    """Test cases for NVIDIA API service"""

    def setUp(self):
        """Set up test fixtures"""
        # Mock environment for testing
        self.mock_api_key = "test-api-key"
        self.mock_messages = [
            {"role": "user", "content": "Hello, how are you?"}
        ]

    @patch("bias_detection.services.nvidia_api_service.os.path.exists")
    @patch("bias_detection.services.nvidia_api_service.open")
    def test_init_with_config_file(self, mock_open, mock_exists):
        """Test initialization with config file"""
        # Mock config file existence
        mock_exists.return_value = True

        # Mock config file content
        mock_config = {
            "Providers": [
                {
                    "name": "nvidia",
                    "api_base_url": "https://test.api.nvidia.com/v1/chat/completions",
                    "api_key": self.mock_api_key,
                    "models": ["moonshotai/kimi-k2.5"]
                }
            ]
        }
        mock_file = MagicMock()
        mock_file.__enter__.return_value.read.return_value = str(mock_config).replace("'", '"')
        mock_open.return_value = mock_file

        # Create service instance
        service = NvidiaAPIService()

        # Verify configuration was loaded
        self.assertEqual(service.api_key, self.mock_api_key)
        self.assertEqual(service.api_base_url, "https://test.api.nvidia.com/v1/chat/completions")

    @patch("bias_detection.services.nvidia_api_service.os.path.exists")
    @patch.dict("bias_detection.services.nvidia_api_service.os.environ", {"NVIDIA_API_KEY": "env-api-key"})
    def test_init_with_env_var(self, mock_exists):
        """Test initialization with environment variable"""
        # Mock config file not existing
        mock_exists.return_value = False

        # Create service instance
        service = NvidiaAPIService()

        # Verify API key was loaded from environment
        self.assertEqual(service.api_key, "env-api-key")

    @patch("bias_detection.services.nvidia_api_service.os.path.exists")
    def test_init_without_config_raises_error(self, mock_exists):
        """Test initialization without config raises error"""
        # Mock config file not existing
        mock_exists.return_value = False

        # Mock environment variable not set
        with patch.dict("bias_detection.services.nvidia_api_service.os.environ", {}, clear=True):
            with self.assertRaises(ValueError):
                NvidiaAPIService()

    @patch("bias_detection.services.nvidia_api_service.httpx.AsyncClient")
    async def test_chat_completion_success(self, mock_httpx_client):
        """Test successful chat completion"""
        # Mock HTTP client and response
        mock_client_instance = AsyncMock()
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        mock_response = AsyncMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Hello! I'm doing well, thank you for asking."}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20}
        }
        mock_response.raise_for_status = AsyncMock()
        mock_client_instance.post.return_value = mock_response

        # Create service instance
        service = NvidiaAPIService()
        service.api_key = self.mock_api_key

        # Call method
        result = await service.chat_completion(self.mock_messages)

        # Verify results
        self.assertIn("choices", result)
        mock_client_instance.post.assert_called_once()

    @patch("bias_detection.services.nvidia_api_service.httpx.AsyncClient")
    async def test_chat_completion_http_error(self, mock_httpx_client):
        """Test chat completion with HTTP error"""
        # Mock HTTP client and response
        mock_client_instance = AsyncMock()
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        mock_response = AsyncMock()
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")
        mock_client_instance.post.return_value = mock_response

        # Create service instance
        service = NvidiaAPIService()
        service.api_key = self.mock_api_key

        # Call method and expect exception
        with self.assertRaises(Exception):
            await service.chat_completion(self.mock_messages)

    @patch("bias_detection.services.nvidia_api_service.httpx.AsyncClient")
    async def test_health_check_success(self, mock_httpx_client):
        """Test successful health check"""
        # Mock HTTP client
        mock_client_instance = AsyncMock()
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock()
        mock_client_instance.post.return_value = mock_response

        # Create service instance
        service = NvidiaAPIService()
        service.api_key = self.mock_api_key

        # Call method
        result = await service.health_check()

        # Verify results
        self.assertEqual(result["status"], "healthy")
        self.assertEqual(result["provider"], "nvidia")

    async def test_convenience_functions(self):
        """Test convenience functions"""
        # Mock the service
        with patch("bias_detection.services.nvidia_api_service.NvidiaAPIService") as mock_service_class:
            mock_service_instance = AsyncMock()
            mock_service_class.return_value = mock_service_instance

            # Test kimi_chat_completion
            await kimi_chat_completion(self.mock_messages)
            mock_service_instance.chat_completion.assert_called_once_with(
                messages=self.mock_messages,
                max_tokens=16384,
                temperature=1.0,
                top_p=1.0,
                stream=False,
                thinking=True
            )


# Example of how to run tests
def run_tests():
    """Run all tests in this module"""
    unittest.main()


if __name__ == "__main__":
    # Run tests if script is executed directly
    run_tests()
