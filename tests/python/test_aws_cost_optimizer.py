"""
Unit tests for AWSCostOptimizer utility.
"""

from unittest.mock import MagicMock

import pytest

from scripts.devops.aws_cost_optimizer import AWSCostOptimizer, CostAuditReport, Finding


def test_cost_audit_report_totals():
    report = CostAuditReport(timestamp="2026-09-24T00:00:00Z", region="us-west-2")
    report.findings = [
        Finding(
            category="CloudWatch Logs",
            resource_id="/ecs/app",
            resource_type="LogGroup",
            region="us-west-2",
            description="Uncapped retention",
            estimated_monthly_savings_usd=10.0,
            action_required="Set 30 days retention",
        ),
        Finding(
            category="EC2 Networking",
            resource_id="eipalloc-12345",
            resource_type="ElasticIP",
            region="us-west-2",
            description="Unassociated EIP",
            estimated_monthly_savings_usd=3.65,
            action_required="Release IP",
        ),
    ]
    report.calculate_totals()
    assert report.total_estimated_monthly_savings_usd == 13.65
    assert report.total_estimated_annual_savings_usd == pytest.approx(163.8)


def test_audit_cloudwatch_logs():
    mock_session = MagicMock()
    mock_logs_client = MagicMock()
    mock_session.client.return_value = mock_logs_client

    mock_paginator = MagicMock()
    mock_logs_client.get_paginator.return_value = mock_paginator
    mock_paginator.paginate.return_value = [
        {
            "logGroups": [
                {
                    "logGroupName": "/aws/eks/pixelated-eks/cluster",
                    "retentionInDays": 30,
                    "storedBytes": 1024 * 1024 * 1024,
                },
                {
                    "logGroupName": "/ecs/business-strategy-cms",
                    "retentionInDays": None,  # No retention set
                    "storedBytes": 10 * 1024 * 1024 * 1024,  # 10 GB
                },
            ]
        }
    ]

    optimizer = AWSCostOptimizer(region="us-west-2", dry_run=True, session=mock_session)
    findings = optimizer.audit_cloudwatch_logs(target_retention_days=30, apply_fix=False)

    assert len(findings) == 1
    assert findings[0].resource_id == "/ecs/business-strategy-cms"
    assert findings[0].estimated_monthly_savings_usd > 0
    assert not findings[0].remediated


def test_audit_unattached_ebs_volumes():
    mock_session = MagicMock()
    mock_ec2_client = MagicMock()
    mock_session.client.return_value = mock_ec2_client

    mock_ec2_client.describe_volumes.return_value = {
        "Volumes": [
            {
                "VolumeId": "vol-0123456789abcdef0",
                "Size": 100,
                "VolumeType": "gp3",
                "State": "available",
            }
        ]
    }

    optimizer = AWSCostOptimizer(region="us-west-2", dry_run=True, session=mock_session)
    findings = optimizer.audit_unattached_ebs_volumes(apply_fix=False)

    assert len(findings) == 1
    assert findings[0].resource_id == "vol-0123456789abcdef0"
    assert findings[0].estimated_monthly_savings_usd == 8.0  # 100GB * 0.08


def test_audit_unassociated_elastic_ips():
    mock_session = MagicMock()
    mock_ec2_client = MagicMock()
    mock_session.client.return_value = mock_ec2_client

    mock_ec2_client.describe_addresses.return_value = {
        "Addresses": [
            {
                "AllocationId": "eipalloc-11111",
                "PublicIp": "54.214.10.20",
                "AssociationId": "eipassoc-22222",  # Associated
            },
            {
                "AllocationId": "eipalloc-33333",
                "PublicIp": "54.214.10.30",
                "AssociationId": None,  # Unassociated
            },
        ]
    }

    optimizer = AWSCostOptimizer(region="us-west-2", dry_run=True, session=mock_session)
    findings = optimizer.audit_unassociated_elastic_ips(apply_fix=False)

    assert len(findings) == 1
    assert findings[0].resource_id == "eipalloc-33333"
    assert findings[0].estimated_monthly_savings_usd == 3.65


def test_audit_s3_bucket_lifecycle():
    mock_session = MagicMock()
    mock_s3_client = MagicMock()
    mock_session.client.return_value = mock_s3_client

    mock_s3_client.list_buckets.return_value = {"Buckets": [{"Name": "pixelated-empathy-backups"}]}
    # Raise exception when getting lifecycle (means no lifecycle configuration)
    mock_s3_client.get_bucket_lifecycle_configuration.side_effect = Exception("NoSuchLifecycleConfiguration")

    optimizer = AWSCostOptimizer(region="us-west-2", dry_run=True, session=mock_session)
    findings = optimizer.audit_s3_bucket_lifecycle(apply_fix=False)

    assert len(findings) == 1
    assert findings[0].resource_id == "pixelated-empathy-backups"
