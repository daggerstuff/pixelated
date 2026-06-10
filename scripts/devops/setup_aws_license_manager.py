#!/usr/bin/env python3
"""Setup AWS License Manager Service-Linked Role.

This script checks if the AWSServiceRoleForAWSLicenseManagerRole exists
and creates it if not.
"""

import argparse
import logging
import sys

try:
    import boto3
    from botocore.exceptions import ClientError

    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def setup_license_manager_role(profile_name=None, region_name=None):
    """Checks and creates the AWS License Manager Service-Linked Role."""
    if not BOTO3_AVAILABLE:
        logger.error("boto3 is not installed. Please install it using 'pip install boto3' or 'uv pip install boto3'.")
        return False

    try:
        session = boto3.Session(profile_name=profile_name, region_name=region_name)
        iam = session.client("iam")
    except Exception as e:
        logger.error("Error initializing AWS Session: %s", e)
        return False

    role_name = "AWSServiceRoleForAWSLicenseManagerRole"
    service_name = "license-manager.amazonaws.com"

    logger.info("Checking if service-linked role '%s' exists...", role_name)
    try:
        iam.get_role(RoleName=role_name)
        logger.info("Service-linked role '%s' already exists.", role_name)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchEntity":
            logger.info(
                "Service-linked role '%s' does not exist. Attempting to create it...",
                role_name,
            )
            try:
                iam.create_service_linked_role(AWSServiceName=service_name)
                logger.info(
                    "Successfully created service-linked role '%s' for service '%s'.",
                    role_name,
                    service_name,
                )
                return True
            except ClientError as create_err:
                logger.error("Failed to create service-linked role: %s", create_err)
                return False
        else:
            logger.error("Error checking role: %s", e)
            return False


def main():
    """Main execution entrypoint."""
    parser = argparse.ArgumentParser(description="Setup AWS License Manager Service-Linked Role.")
    parser.add_argument("--profile", help="AWS CLI credential profile name to use.")
    parser.add_argument("--region", help="AWS Region (e.g. us-east-1).")
    args = parser.parse_args()

    success = setup_license_manager_role(profile_name=args.profile, region_name=args.region)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
