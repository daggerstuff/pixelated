## Journal Research User Guide

## Overview

The Journal Research system is a comprehensive, integrated platform for managing journal dataset research operations. The system consists of three interfaces that work together:

- **Web Frontend**: User-friendly web interface (this guide focuses on this)
- **MCP Server**: AI agent interface via Model Context Protocol
- **CLI Interface**: Command-line access for automation

All three interfaces access the same backend research engine and share the same session data. This guide focuses on the web interface. For information about the complete system architecture, see the [Journal Research Pipeline Documentation](../../development/journal-research/journal-research-pipeline.md).

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Workflows](#workflows)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### Prerequisites

- A user account with appropriate permissions
- Access to the Journal Research web interface
- JavaScript enabled in your browser

### First Steps

1. **Log In**
   - Navigate to the login page
   - Enter your credentials
   - You'll be redirected to the dashboard upon successful login

2. **Access the Dashboard**
   - The dashboard provides an overview of all your research sessions
   - View recent activity and progress metrics
   - Quick actions are available in the top right

3. **Create Your First Session**
   - Click "New Session" button
   - Fill in the session details:
     - **Target Sources**: Select data sources (e.g., PubMed, DOAJ)
     - **Search Keywords**: Define keywords organized by category
     - **Weekly Targets**: Set goals for sources identified, datasets evaluated, etc.
   - Click "Create Session"

## Features

### Session Management

#### Creating Sessions
- Sessions organize your research work
- Each session tracks progress through discovery, evaluation, acquisition, and integration phases
- Sessions can be edited or deleted (with appropriate permissions)

#### Session List
- View all your sessions in a paginated list
- Filter by phase (discovery, evaluation, acquisition, integration)
- Search by session ID, sources, or keywords
- Sort by date or progress

#### Session Details
- View comprehensive session information
- Monitor progress metrics
- Navigate between phases
- Generate reports

### Source Discovery

#### Initiating Discovery
1. Navigate to the Discovery page
2. Select a session (or create a new one)
3. Configure discovery parameters:
   - **Sources**: Choose which data sources to search
   - **Keywords**: Define search keywords by category
   - **Max Results**: Set maximum number of results
4. Click "Start Discovery"

#### Monitoring Discovery
- View discovered sources in real-time
- Filter sources by:
  - Source type (journal article, dataset, etc.)
  - Open access status
  - Keywords
- Sort by relevance, date, or title
- Click on a source to view details

#### Source Details
- View full source information:
  - Title, authors, publication date
  - Abstract and keywords
  - DOI and URL
  - Data availability information
- See discovery metadata (when and how it was discovered)

### Source Evaluation

#### Initiating Evaluation
1. Navigate to the Evaluation page
2. Select sources to evaluate (from discovered sources)
3. Configure evaluation criteria:
   - Quality threshold (0-1)
   - Relevance threshold (0-1)
4. Click "Start Evaluation"

#### Viewing Evaluations
- See evaluation results with quality and relevance scores
- Filter by:
  - Priority tier
  - Score range
- Sort by overall score, quality, or relevance
- View evaluation details and recommendations

#### Manual Evaluation Override
- Edit evaluations manually if needed
- Update scores and recommendations
- Add notes and comments

### Dataset Acquisition

#### Initiating Acquisition
1. Navigate to the Acquisition page
2. Select evaluated sources to acquire
3. Configure acquisition:
   - **Method**: Download, API, manual upload
   - **Storage Location**: Where to store acquired datasets
4. Click "Start Acquisition"

#### Monitoring Acquisition
- Track acquisition progress in real-time
- View status: pending, in_progress, completed, failed
- See storage location and file size
- Filter by status

#### Approval Workflow
- Review acquisitions before finalizing
- Approve or reject acquisitions
- Update acquisition status manually if needed

### Integration Planning

#### Creating Integration Plans
1. Navigate to the Integration page
2. Select acquisitions to include in the plan
3. Configure integration:
   - **Strategy**: Merge, append, or transform
   - **Target Schema**: Select target schema
4. Click "Create Integration Plan"

#### Viewing Integration Plans
- See preprocessing steps and scripts
- View schema mappings
- Monitor plan execution status
- Download preprocessing scripts

### Progress Tracking

#### Dashboard Progress
- View overall progress for selected session
- See phase-by-phase progress breakdown
- Compare actual metrics vs targets
- Real-time updates via WebSocket

#### Progress Charts
- Visualize progress over time
- See metrics trends
- Identify bottlenecks
- Export progress data

### Report Generation

#### Generating Reports
1. Navigate to the Reports page
2. Select a session
3. Configure report:
   - **Type**: Summary, detailed, custom
   - **Format**: PDF, HTML, JSON
   - **Sections**: Choose which sections to include
   - **Charts**: Include/exclude charts
4. Click "Generate Report"

#### Viewing Reports
- View generated reports in the browser
- Download reports in selected format
- Print reports
- View report metadata (generation date, size, etc.)

## Workflows

### Complete Research Workflow

1. **Create Session**
   - Define research goals and targets
   - Set up search keywords

2. **Discover Sources**
   - Initiate discovery with configured parameters
   - Review discovered sources
   - Filter and sort as needed

3. **Evaluate Sources**
   - Select promising sources
   - Run automated evaluation
   - Review and adjust scores manually

4. **Acquire Datasets**
   - Select evaluated sources to acquire
   - Monitor acquisition progress
   - Verify successful acquisitions

5. **Plan Integration**
   - Create integration plan for acquired datasets
   - Review preprocessing steps
   - Download preprocessing scripts

6. **Generate Report**
   - Create comprehensive report
   - Review findings
   - Export for sharing

### Quick Start Workflow

1. Create session with default settings
2. Start discovery with common keywords
3. Review top-scoring sources
4. Acquire recommended sources
5. Generate summary report

## Troubleshooting

### Common Issues

#### "Session not found" Error

**Problem**: Trying to access a session that doesn't exist or you don't have permission to view.

**Solution**:
- Verify the session ID is correct
- Check that you have `sessions:read` permission
- Ensure you're logged in with the correct account

#### Discovery Not Starting

**Problem**: Discovery operation doesn't start or shows "pending" status indefinitely.

**Solution**:
- Check that you have `discovery:create` permission
- Verify session ID is valid
- Check network connection
- Review server logs for errors
- Try refreshing the page

#### Progress Not Updating

**Problem**: Progress metrics don't update in real-time.

**Solution**:
- Check WebSocket connection status (should show "Connected")
- Verify session ID is correct
- Try refreshing the page
- Check browser console for WebSocket errors
- Ensure WebSocket is not blocked by firewall/proxy

#### Evaluation Scores Not Appearing

**Problem**: Evaluation completes but scores are missing.

**Solution**:
- Check evaluation status (should be "completed")
- Verify source was properly evaluated
- Try refreshing the evaluation list
- Check if manual override is needed
- Review evaluation details page

#### Acquisition Fails

**Problem**: Acquisition operation fails with error.

**Solution**:
- Check acquisition status and error message
- Verify source is available and accessible
- Check storage location permissions
- Ensure sufficient storage space
- Review acquisition details for specific error

#### Report Generation Fails

**Problem**: Report generation fails or times out.

**Solution**:
- Check report status
- Try generating a smaller report (fewer sections)
- Ensure session has data to report on
- Check server logs for errors
- Try again after a few minutes

### Performance Issues

#### Slow Page Loading

**Solutions**:
- Clear browser cache
- Check network connection
- Reduce number of items per page
- Use filters to narrow results
- Close unused browser tabs

#### Real-time Updates Lagging

**Solutions**:
- Check WebSocket connection
- Reduce number of active sessions
- Close unused browser tabs
- Check browser console for errors
- Refresh the page

### Browser Compatibility

**Supported Browsers**:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

**Required Features**:
- JavaScript enabled
- WebSocket support
- LocalStorage enabled
- Cookies enabled

## FAQ

### General Questions

**Q: How many sessions can I create?**
A: There's no hard limit, but performance may degrade with very large numbers. Consider archiving old sessions.

**Q: Can I share sessions with other users?**
A: Session access is controlled by permissions. Contact your administrator to grant access to other users.

**Q: How long are sessions stored?**
A: Sessions are stored indefinitely unless manually deleted. Check with your administrator for retention policies.

**Q: Can I export session data?**
A: Yes, use the report generation feature to export session data in various formats.

### Discovery Questions

**Q: How many sources can I discover per session?**
A: There's no hard limit, but very large discovery operations may take longer. Use the `max_results` parameter to limit results.

**Q: Can I discover from multiple sources simultaneously?**
A: Yes, select multiple sources when initiating discovery.

**Q: How often are sources updated?**
A: Discovery results are cached. New discovery operations fetch fresh data.

### Evaluation Questions

**Q: What do quality and relevance scores mean?**
A: Both scores range from 0-1:
- **Quality**: Dataset quality, documentation, license clarity
- **Relevance**: How well the dataset matches your research goals

**Q: Can I change evaluation scores?**
A: Yes, use the manual evaluation override feature to edit scores and recommendations.

**Q: What does "recommendation" mean?**
A: Recommendations suggest whether to acquire a source:
- **Acquire**: High quality and relevance, recommended for acquisition
- **Review**: Needs manual review before decision
- **Reject**: Low quality or relevance, not recommended

### Acquisition Questions

**Q: Where are datasets stored?**
A: Datasets are stored in the configured storage location (e.g., S3 bucket). Check acquisition details for exact location.

**Q: Can I download datasets directly?**
A: Yes, if the source provides direct download links. Otherwise, datasets are acquired through the configured method.

**Q: What happens if acquisition fails?**
A: Failed acquisitions show error details. You can retry or update the acquisition configuration.

### Integration Questions

**Q: Can I modify integration plans?**
A: Integration plans can be regenerated with different parameters. Preprocessing scripts can be customized.

**Q: How do I use preprocessing scripts?**
A: Download the script and run it on your acquired datasets. Scripts are provided in Python format.

**Q: Can I create multiple integration plans per session?**
A: Yes, you can create multiple integration plans with different configurations.

### Progress Questions

**Q: How is progress calculated?**
A: Progress is calculated based on completed phases and metrics compared to targets. Overall progress is a weighted average.

**Q: Why doesn't progress match my expectations?**
A: Progress calculation considers all phases. Check individual phase progress and metrics for details.

**Q: Can I set custom targets?**
A: Yes, set weekly targets when creating or updating a session.

### Report Questions

**Q: What report formats are available?**
A: PDF, HTML, and JSON formats are supported.

**Q: Can I customize report content?**
A: Yes, select which sections to include when generating reports.

**Q: How long do reports take to generate?**
A: Report generation time depends on session size and selected sections. Typically 30 seconds to 2 minutes.

## Support

For additional support:
- Check the API documentation for technical details
- Review component documentation for UI customization
- Contact your administrator for permission issues
- Submit a support ticket for bugs or feature requests

**Last Updated**: January 2025

