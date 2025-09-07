# Google Drive Dataset Manager Setup Guide

This guide will walk you through setting up the Google Drive Dataset Manager for the Pixelated Empathy project.

## Prerequisites

- Python 3.11 or higher
- UV (Python package manager) - Install from https://docs.astral.sh/uv/
- Google account with access to Google Drive
- Basic familiarity with command-line tools

## Step 1: Installation

1. **Navigate to the tool directory:**
   ```bash
   cd /home/vivi/pixelated/tools/gdrive-dataset-manager
   ```

2. **Install the package using UV:**
   ```bash
   uv sync
   ```

   This will automatically create a virtual environment and install all dependencies.

## Step 2: Google Drive API Setup

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Give your project a name (e.g., "Pixelated Dataset Manager")
4. Click "Create"

### 2.2 Enable Google Drive API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API" and then "Enable"

### 2.3 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields (App name, User support email, Developer email)
   - Add your email to test users
4. For OAuth client ID:
   - Choose "Desktop application"
   - Give it a name (e.g., "Dataset Manager")
   - Click "Create"
5. Download the JSON file
6. Rename it to `credentials.json` and place it in the tool directory

### 2.4 Get Your Google Drive Folder ID

1. Open Google Drive in your browser
2. Create a folder for your datasets (e.g., "Pixelated Datasets")
3. Open the folder
4. Copy the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE
   ```

## Step 3: Configuration

1. **Edit the configuration file:**
   ```bash
   nano config.yaml
   ```

2. **Update the folder_id:**
   ```yaml
   google_drive:
     folder_id: "YOUR_FOLDER_ID_FROM_STEP_2.4"
     credentials_file: "credentials.json"
     application_name: "Pixelated Dataset Manager"
   ```

3. **Verify configuration:**
   ```bash
   uv run gdrive-cli config-info
   ```

## Step 4: Authentication

1. **Run the authentication command:**
   ```bash
   uv run gdrive-cli auth
   ```

2. **Follow the OAuth flow:**
   - A browser window will open
   - Sign in to your Google account
   - Grant permissions to the application
   - Copy the authorization code if prompted

3. **Verify authentication:**
   The command should show "Authentication successful" and "Connection test passed"

## Step 5: Test the Setup

1. **List datasets (should be empty initially):**
   ```bash
   uv run gdrive-cli list
   ```

2. **Check quota:**
   ```bash
   uv run gdrive-cli quota
   ```

3. **Test upload with a small file:**
   ```bash
   echo "test data" > test_file.txt
   uv run gdrive-cli upload test_file.txt
   rm test_file.txt
   ```

4. **Verify the file appears in your Google Drive folder**

## Step 6: Migrate Existing Datasets

### 6.1 Upload Current Datasets

```bash
# Upload the main datasets directory
uv run gdrive-cli upload "../../ai/datasets" --name "ai_datasets" --folder "datasets"

# Upload processed data
uv run gdrive-cli upload "../../ai/data/processed" --name "processed_data" --folder "processed"
```

### 6.2 Create Folder Structure

```bash
# You can create organized folders for different types of datasets
uv run gdrive-cli upload "../../ai/datasets/mental_health_counseling_conversations" --folder "mental_health"
uv run gdrive-cli upload "../../ai/datasets/reddit_mental_health" --folder "social_media"
uv run gdrive-cli upload "../../ai/datasets/psychology-10k" --folder "academic"
```

## Step 7: Daily Usage Examples

### Download Specific Datasets
```bash
# Search for datasets
uv run gdrive-cli list --search "mental_health"

# Download a specific dataset
uv run gdrive-cli download "mental_health_conversations"

# Download to specific location
uv run gdrive-cli download "dataset_name" --destination "../../ai/datasets/"
```

### Upload New Datasets
```bash
# Upload new dataset
uv run gdrive-cli upload "./new_dataset_folder" --name "new_dataset_v2"

# Upload with compression disabled
uv run gdrive-cli upload "./large_files" --no-compress
```

### Maintenance
```bash
# Check storage usage
uv run gdrive-cli quota

# Clean up temporary files
uv run gdrive-cli cleanup --all

# View configuration
uv run gdrive-cli config-info
```

## Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Ensure `credentials.json` is in the correct location
   - Verify the OAuth consent screen is configured
   - Try deleting `token.json` and re-running `uv run gdrive-cli auth`

2. **"Folder not found"**
   - Double-check the folder ID in `config.yaml`
   - Ensure the folder exists and you have access to it

3. **"Permission denied" errors**
   - Verify the OAuth scopes include Google Drive access
   - Check that your Google account has access to the target folder

4. **Large file upload failures**
   - Increase the `upload.chunk_size` in `config.yaml`
   - Check your internet connection stability
   - Verify you have sufficient Google Drive storage

### Debug Mode

For detailed troubleshooting, use debug mode:

```bash
uv run gdrive-cli --debug COMMAND
```

### Log Files

Check the log file for detailed error information:

```bash
tail -f gdrive_manager.log
```

## Security Best Practices

1. **Never commit credentials:**
   ```bash
   # Add to .gitignore
   echo "credentials.json" >> .gitignore
   echo "token.json" >> .gitignore
   echo "gdrive_manager.log" >> .gitignore
   ```

2. **Limit OAuth scope:**
   The tool only requests Google Drive access, not full Google account access.

3. **Regular credential rotation:**
   Consider regenerating credentials periodically.

4. **Secure storage:**
   Ensure the tool directory has appropriate file permissions.

## Next Steps

1. **Set up automated backups:**
   Create cron jobs or scheduled tasks to regularly upload datasets

2. **Organize your Drive:**
   Create a clear folder structure in Google Drive for different dataset types

3. **Monitor usage:**
   Regularly check storage quota and clean up old datasets

4. **Share access:**
   Add team members to the Google Drive folder for collaborative access

## Support

For additional help:
- Check the main README.md for detailed command reference
- Review log files for error details
- Use debug mode for troubleshooting
- Consult Google Drive API documentation for advanced configurations
