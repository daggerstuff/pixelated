#!/bin/bash
set -euo pipefail

# Pixelated Empathy - ECS Deployment Verification Script
# Usage: ./scripts/verify-ecs-deployment.sh <staging|production>

ENVIRONMENT="${1:-staging}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER_NAME="pixelated-empathy-${ENVIRONMENT}"
SERVICE_NAME="pixelated-empathy-api-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Verifying ECS Deployment: ${ENVIRONMENT}"
echo "Cluster: ${CLUSTER_NAME}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${AWS_REGION}"
echo "=========================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}ERROR: AWS CLI not configured or credentials invalid${NC}"
    exit 1
fi

# 1. Verify ECS Cluster exists
echo ""
echo "Step 1: Checking ECS Cluster..."
if aws ecs describe-clusters --clusters "${CLUSTER_NAME}" --region "${AWS_REGION}" | grep -q "\"status\": \"ACTIVE\""; then
    echo -e "${GREEN}✓ ECS Cluster '${CLUSTER_NAME}' is ACTIVE${NC}"
else
    echo -e "${RED}✗ ECS Cluster '${CLUSTER_NAME}' not found or not active${NC}"
    exit 1
fi

# 2. Verify ECS Service exists and is stable
echo ""
echo "Step 2: Checking ECS Service..."
SERVICE_JSON=$(aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}")
if echo "${SERVICE_JSON}" | grep -q "\"status\": \"ACTIVE\""; then
    echo -e "${GREEN}✓ ECS Service '${SERVICE_NAME}' is ACTIVE${NC}"
else
    echo -e "${RED}✗ ECS Service '${SERVICE_NAME}' not found or not active${NC}"
    exit 1
fi

DESIRED_COUNT=$(echo "${SERVICE_JSON}" | grep -o '"desiredCount": [0-9]*' | awk '{print $2}')
RUNNING_COUNT=$(echo "${SERVICE_JSON}" | grep -o '"runningCount": [0-9]*' | awk '{print $2}')
PENDING_COUNT=$(echo "${SERVICE_JSON}" | grep -o '"pendingCount": [0-9]*' | awk '{print $2}')

echo "  Desired tasks: ${DESIRED_COUNT}"
echo "  Running tasks: ${RUNNING_COUNT}"
echo "  Pending tasks: ${PENDING_COUNT}"

if [ "${RUNNING_COUNT}" -ge "${DESIRED_COUNT}" ]; then
    echo -e "${GREEN}✓ Service is running desired count (${DESIRED_COUNT})${NC}"
else
    echo -e "${YELLOW}⚠ Service is below desired count. Waiting...${NC}"
fi

# 3. Verify Task Health
echo ""
echo "Step 3: Checking Task Health..."
TASKS=$(aws ecs list-tasks --cluster "${CLUSTER_NAME}" --service-name "${SERVICE_NAME}" --region "${AWS_REGION}" --query 'taskArns[]' --output text)

if [ -z "${TASKS}" ] || [ "${TASKS}" == "None" ]; then
    echo -e "${RED}✗ No tasks found for service${NC}"
    exit 1
fi

for TASK_ARN in ${TASKS}; do
    TASK_STATUS=$(aws ecs describe-tasks --cluster "${CLUSTER_NAME}" --tasks "${TASK_ARN}" --region "${AWS_REGION}" --query 'tasks[0].lastStatus' --output text)
    HEALTH_STATUS=$(aws ecs describe-tasks --cluster "${CLUSTER_NAME}" --tasks "${TASK_ARN}" --region "${AWS_REGION}" --query 'tasks[0].healthStatus' --output text)

    echo "  Task: ${TASK_ARN}"
    echo "    Status: ${TASK_STATUS}"
    echo "    Health: ${HEALTH_STATUS}"

    if [ "${TASK_STATUS}" == "RUNNING" ] && [ "${HEALTH_STATUS}" == "HEALTHY" ]; then
        echo -e "    ${GREEN}✓ Task is healthy${NC}"
    elif [ "${TASK_STATUS}" == "RUNNING" ]; then
        echo -e "    ${YELLOW}⚠ Task is running but health status is: ${HEALTH_STATUS}${NC}"
    else
        echo -e "    ${RED}✗ Task status: ${TASK_STATUS}${NC}"
    fi
done

# 4. Verify Load Balancer Health
echo ""
echo "Step 4: Checking Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-bal --names "pixelated-empathy-alb" --region "${AWS_REGION}" 2>/dev/null | grep -o '"LoadBalancerArn": "[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "${ALB_ARN}" ]; then
    ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "${ALB_ARN}" --region "${AWS_REGION}" --query 'LoadBalancers[0].DNSName' --output text)
    echo -e "${GREEN}✓ ALB found: ${ALB_DNS}${NC}"
    echo "  Testing health endpoint..."
    if curl -sf "http://${ALB_DNS}/health" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Health check passed${NC}"
    else
        echo -e "  ${YELLOW}⚠ Health check failed (might be expected if app requires auth)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ ALB 'pixelated-empathy-alb' not found (may have different name)${NC}"
fi

# 5. Verify CloudWatch Logs
echo ""
echo "Step 5: Checking CloudWatch Logs..."
LOG_GROUP="/ecs/pixelated-empathy-api"
if aws logs describe-log-groups --log-group-name-prefix "${LOG_GROUP}" --region "${AWS_REGION}" | grep -q "${LOG_GROUP}"; then
    echo -e "${GREEN}✓ CloudWatch log group '${LOG_GROUP}' exists${NC}"
    # Show recent log entries
    echo "  Recent log entries:"
    aws logs tail "${LOG_GROUP}" --region "${AWS_REGION}" --since 5m || true
else
    echo -e "${YELLOW}⚠ CloudWatch log group '${LOG_GROUP}' not found${NC}"
fi

# 6. Verify ECR Repository
echo ""
echo "Step 6: Checking ECR Repository..."
if aws ecr describe-repositories --repository-names "pixelated-empathy-api" --region "${AWS_REGION}" &>/dev/null; then
    echo -e "${GREEN}✓ ECR repository 'pixelated-empathy-api' exists${NC}"
    # Show image count
    IMAGE_COUNT=$(aws ecr describe-images --repository-name "pixelated-empathy-api" --region "${AWS_REGION}" --query 'imageDetails | length(@)' --output text 2>/dev/null || echo "0")
    echo "  Images in repository: ${IMAGE_COUNT}"
else
    echo -e "${RED}✗ ECR repository 'pixelated-empathy-api' not found${NC}"
fi

# 7. Summary
echo ""
echo "=========================================="
echo "Verification Summary:"
echo "=========================================="

if [ "${RUNNING_COUNT}" -ge "${DESIRED_COUNT}" ] 2>/dev/null && [ "${HEALTH_STATUS}" == "HEALTHY" ]; then
    echo -e "${GREEN}✓ DEPLOYMENT VERIFIED${NC}"
    echo -e "${GREEN}  The ECS service is running and healthy.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open the ALB DNS in a browser: http://${ALB_DNS}"
    echo "  2. Monitor CloudWatch logs for any errors"
    echo "  3. Set up DNS (Route 53) to point to the ALB"
    exit 0
else
    echo -e "${YELLOW}⚠ Deployment may need attention${NC}"
    echo "  Check the AWS ECS Console for more details"
    echo "  Review CloudWatch logs for errors"
    exit 1
fi
[Error processing citation]