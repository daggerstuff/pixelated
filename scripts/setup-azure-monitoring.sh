#!/bin/bash

# Azure Monitoring Setup Script for Pixelated Application
set -e

echo "🔍 Setting up Azure monitoring and alerting..."

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"
APP_INSIGHTS_NAME="${AZURE_APP_INSIGHTS_NAME:-pixelated-insights}"
LOG_ANALYTICS_NAME="${AZURE_LOG_ANALYTICS_NAME:-pixelated-logs}"
ACTION_GROUP_NAME="${AZURE_ACTION_GROUP_NAME:-pixelated-alerts}"
NOTIFICATION_EMAIL="${AZURE_NOTIFICATION_EMAIL}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    set -a
    source .env
    set +a
fi

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Application Insights: $APP_INSIGHTS_NAME"
echo "  Log Analytics: $LOG_ANALYTICS_NAME"
echo "  Action Group: $ACTION_GROUP_NAME"
echo "  Notification Email: $NOTIFICATION_EMAIL"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Set subscription if provided
if [ ! -z "$SUBSCRIPTION_ID" ]; then
    echo "🔧 Setting Azure subscription..."
    az account set --subscription "$SUBSCRIPTION_ID"
fi

# Get Application Insights details
echo "📊 Getting Application Insights details..."
APP_INSIGHTS_ID=$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "id" \
    --output tsv 2>/dev/null || echo "")

if [ -z "$APP_INSIGHTS_ID" ]; then
    echo "❌ Application Insights '$APP_INSIGHTS_NAME' not found in resource group '$RESOURCE_GROUP'"
    echo "Please ensure the infrastructure is deployed first."
    exit 1
fi

echo "✅ Application Insights found: $APP_INSIGHTS_ID"

# Create Action Group for notifications
if [ ! -z "$NOTIFICATION_EMAIL" ]; then
    echo "📧 Creating action group for notifications..."
    
    az monitor action-group create \
        --name "$ACTION_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --short-name "PixelAlert" \
        --email-receivers \
            name="Admin" \
            email="$NOTIFICATION_EMAIL" \
        --output table

    ACTION_GROUP_ID=$(az monitor action-group show \
        --name "$ACTION_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "id" \
        --output tsv)

    echo "✅ Action group created: $ACTION_GROUP_ID"
else
    echo "⚠️ No notification email provided, skipping action group creation"
    ACTION_GROUP_ID=""
fi

# Deploy alert rules using Bicep
echo "🚨 Deploying alert rules..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "deploy/azure/monitoring/alerts.bicep" \
    --parameters \
        appInsightsName="$APP_INSIGHTS_NAME" \
        appInsightsResourceId="$APP_INSIGHTS_ID" \
        location="global" \
        actionGroupResourceId="$ACTION_GROUP_ID" \
        enableAlerts=true \
    --output table

echo "✅ Alert rules deployed"

# Import dashboard
echo "📊 Setting up monitoring dashboard..."

# Replace placeholder subscription ID in dashboard JSON
DASHBOARD_JSON="deploy/azure/monitoring/dashboard.json"
TEMP_DASHBOARD="/tmp/dashboard-$(date +%s).json"

if [ -f "$DASHBOARD_JSON" ]; then
    # Replace subscription ID placeholder
    sed "s/{subscription-id}/$SUBSCRIPTION_ID/g" "$DASHBOARD_JSON" > "$TEMP_DASHBOARD"
    
    # Create dashboard
    DASHBOARD_NAME="Pixelated-Application-Dashboard"
    az portal dashboard create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DASHBOARD_NAME" \
        --input-path "$TEMP_DASHBOARD" \
        --location "$LOCATION" \
        --output table

    # Clean up temp file
    rm "$TEMP_DASHBOARD"

    echo "✅ Dashboard created: $DASHBOARD_NAME"
else
    echo "⚠️ Dashboard template not found at $DASHBOARD_JSON"
fi

# Configure Application Insights sampling
echo "⚙️ Configuring Application Insights sampling..."
az monitor app-insights component update \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --sampling-percentage 100 \
    --output table

# Set up continuous export (optional)
if [ ! -z "$AZURE_STORAGE_ACCOUNT_NAME" ]; then
    echo "📤 Setting up continuous export to storage..."
    
    STORAGE_ACCOUNT_ID=$(az storage account show \
        --name "$AZURE_STORAGE_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "id" \
        --output tsv 2>/dev/null || echo "")

    if [ ! -z "$STORAGE_ACCOUNT_ID" ]; then
        az monitor app-insights component export create \
            --app "$APP_INSIGHTS_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --record-types "Requests,Dependencies,Exceptions,PageViews,CustomEvents,CustomMetrics" \
            --dest-account "$STORAGE_ACCOUNT_ID" \
            --dest-container "telemetry-export" \
            --dest-sub-id "$SUBSCRIPTION_ID" \
            --dest-type "Blob" \
            --output table

        echo "✅ Continuous export configured"
    else
        echo "⚠️ Storage account not found, skipping continuous export"
    fi
fi

# Create custom workbook
echo "📖 Creating custom workbook..."
WORKBOOK_NAME="Pixelated-Application-Workbook"
WORKBOOK_TEMPLATE='{
  "version": "Notebook/1.0",
  "items": [
    {
      "type": 1,
      "content": {
        "json": "# Pixelated Empathy Application Monitoring\\n\\nComprehensive monitoring dashboard for the Pixelated Empathy application."
      }
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "requests\\n| where timestamp > ago(24h)\\n| summarize RequestCount = count(), AvgDuration = avg(duration), FailureRate = countif(success == false) * 100.0 / count() by bin(timestamp, 1h)\\n| render timechart",
        "size": 0,
        "title": "Request Overview (24h)",
        "queryType": 0,
        "resourceType": "microsoft.insights/components"
      }
    }
  ]
}'

az monitor app-insights workbook create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WORKBOOK_NAME" \
    --display-name "$WORKBOOK_NAME" \
    --serialized-data "$WORKBOOK_TEMPLATE" \
    --category "workbook" \
    --tags "application=pixelated" \
    --output table

echo "✅ Custom workbook created"

# Get monitoring URLs
echo "🔗 Getting monitoring URLs..."
APP_INSIGHTS_URL="https://portal.azure.com/#@/resource$APP_INSIGHTS_ID/overview"
DASHBOARD_URL="https://portal.azure.com/#@/dashboard/arm$RESOURCE_GROUP/providers/Microsoft.Portal/dashboards/$DASHBOARD_NAME"

# Display setup summary
echo ""
echo "✅ Azure monitoring setup completed!"
echo ""
echo "🔗 Monitoring Resources:"
echo "  Application Insights: $APP_INSIGHTS_URL"
echo "  Dashboard: $DASHBOARD_URL"
echo "  Resource Group: https://portal.azure.com/#@/resource/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/overview"
echo ""
echo "📊 Configured Alerts:"
echo "  - High Error Rate (>5% errors in 15 minutes)"
echo "  - Slow Response Time (>5 seconds average)"
echo "  - Exception Rate (>10 exceptions in 15 minutes)"
echo "  - AI Service Failures (>5 failures in 15 minutes)"
echo "  - High Token Usage (>100k tokens in 1 hour)"
echo "  - Authentication Failures (>10 failures in 15 minutes)"
echo "  - Dependency Failures (>5 failures in 15 minutes)"
echo "  - Low Request Volume (potential downtime)"
echo ""
if [ ! -z "$NOTIFICATION_EMAIL" ]; then
    echo "📧 Notifications will be sent to: $NOTIFICATION_EMAIL"
else
    echo "⚠️ No notification email configured. Set AZURE_NOTIFICATION_EMAIL to receive alerts."
fi
echo ""
echo "📋 Next Steps:"
echo "  1. Review and customize alert thresholds in Azure Portal"
echo "  2. Add additional notification channels (SMS, Teams, etc.)"
echo "  3. Create custom queries and visualizations"
echo "  4. Set up automated responses using Logic Apps"
echo "  5. Configure log retention policies"
echo ""
echo "🎉 Monitoring setup completed successfully!"
