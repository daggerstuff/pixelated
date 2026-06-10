#!/usr/bin/env python3
"""Unit tests for setup_aws_license_manager.py."""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError

setup_module_path = Path(__file__).parent.parent.parent.parent / "scripts" / "devops" / "setup_aws_license_manager.py"
spec = importlib.util.spec_from_file_location("setup_aws_license_manager", setup_module_path)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load setup_aws_license_manager module from {setup_module_path}")

setup_aws_lm_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup_aws_lm_module)


@patch("boto3.Session")
def test_setup_license_manager_role_already_exists(mock_session_cls):
    """Test when the service role already exists."""
    mock_session = MagicMock()
    mock_iam = MagicMock()
    mock_session_cls.return_value = mock_session
    mock_session.client.return_value = mock_iam

    # Mock role exists
    mock_iam.get_role.return_value = {"Role": {"RoleName": "AWSServiceRoleForAWSLicenseManagerRole"}}

    result = setup_aws_lm_module.setup_license_manager_role()

    assert result is True
    mock_iam.get_role.assert_called_once_with(RoleName="AWSServiceRoleForAWSLicenseManagerRole")
    mock_iam.create_service_linked_role.assert_not_called()


@patch("boto3.Session")
def test_setup_license_manager_role_creates_new(mock_session_cls):
    """Test when the service role does not exist and is successfully created."""
    mock_session = MagicMock()
    mock_iam = MagicMock()
    mock_session_cls.return_value = mock_session
    mock_session.client.return_value = mock_iam

    # Mock role does not exist (NoSuchEntity)
    error_response = {"Error": {"Code": "NoSuchEntity", "Message": "Not Found"}}
    mock_iam.get_role.side_effect = ClientError(error_response, "GetRole")

    result = setup_aws_lm_module.setup_license_manager_role()

    assert result is True
    mock_iam.get_role.assert_called_once_with(RoleName="AWSServiceRoleForAWSLicenseManagerRole")
    mock_iam.create_service_linked_role.assert_called_once_with(AWSServiceName="license-manager.amazonaws.com")


@patch("boto3.Session")
def test_setup_license_manager_role_creation_fails(mock_session_cls):
    """Test when creation of the service role fails."""
    mock_session = MagicMock()
    mock_iam = MagicMock()
    mock_session_cls.return_value = mock_session
    mock_session.client.return_value = mock_iam

    # Mock role does not exist (NoSuchEntity)
    error_response = {"Error": {"Code": "NoSuchEntity", "Message": "Not Found"}}
    mock_iam.get_role.side_effect = ClientError(error_response, "GetRole")

    # Mock creation fails (AccessDenied)
    create_error_response = {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}
    mock_iam.create_service_linked_role.side_effect = ClientError(create_error_response, "CreateServiceLinkedRole")

    result = setup_aws_lm_module.setup_license_manager_role()

    assert result is False
