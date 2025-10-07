"""
Unit tests for utility functions
"""

import pytest
import os
import json
from unittest.mock import Mock, patch

class TestUtilities:
    """Test utility functions"""
    
    def test_file_operations(self, temp_dir):
        """Test file operation utilities"""
        test_file = temp_dir / "test.txt"
        test_content = "Hello, World!"
        
        # Test write
        with open(test_file, 'w') as f:
            f.write(test_content)
        
        # Test read
        with open(test_file, 'r') as f:
            content = f.read()
        
        assert content == test_content
        assert test_file.exists()
    
    def test_json_operations(self, temp_dir, mock_config):
        """Test JSON operations"""
        json_file = temp_dir / "config.json"
        
        # Test write JSON
        with open(json_file, 'w') as f:
            json.dump(mock_config, f)
        
        # Test read JSON
        with open(json_file, 'r') as f:
            loaded_config = json.load(f)
        
        assert loaded_config == mock_config
        assert loaded_config["model"]["name"] == "test_model"
    
    def test_string_utilities(self):
        """Test string utility functions"""
        def clean_text(text):
            return text.strip().lower()
        
        test_cases = [
            ("  Hello World  ", "hello world"),
            ("UPPERCASE", "uppercase"),
            ("Mixed Case", "mixed case")
        ]
        
        for input_text, expected in test_cases:
            result = clean_text(input_text)
            assert result == expected
    
    def test_validation_functions(self):
        """Test validation utility functions"""
        def validate_email(email):
            return "@" in email and "." in email
        
        valid_emails = ["test@example.com", "user@domain.org"]
        invalid_emails = ["invalid", "no@domain", "missing.com"]
        
        for email in valid_emails:
            assert validate_email(email) == True
        
        for email in invalid_emails:
            assert validate_email(email) == False
    
    @patch('os.path.exists')
    def test_path_validation(self, mock_exists):
        """Test path validation with mocking"""
        mock_exists.return_value = True
        
        def check_path_exists(path):
            return os.path.exists(path)
        
        result = check_path_exists("/fake/path")
        assert result == True
        mock_exists.assert_called_once_with("/fake/path")
