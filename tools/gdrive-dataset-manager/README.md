# Google Drive Dataset Manager

A professional command-line tool for managing AI datasets on Google Drive with enterprise-grade features including authentication, compression, progress tracking, and quota management.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

## Features

✨ **Complete Dataset Management**
- Upload datasets with automatic compression
- Download datasets with progress tracking and verification
- List and search datasets with rich metadata display
- Quota monitoring and storage management

🔐 **Secure Authentication**
- OAuth2 integration with Google Drive API
- Persistent token storage with automatic refresh
- Connection testing and validation

📊 **Rich CLI Experience**
- Beautiful terminal output with progress bars
- Comprehensive error handling and logging
- Flexible configuration management
- Debug mode for troubleshooting

🚀 **Production Ready**
- UV environment isolation
- Type-safe Python 3.11+ codebase
- Comprehensive documentation
- Extensible modular architecture

## Installation

1. **Clone or create the tool directory:**
   ```bash
   mkdir -p tools/gdrive-dataset-manager
   cd tools/gdrive-dataset-manager
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Google Drive API credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Drive API
   - Create credentials (OAuth 2.0 Client ID)
   - Download the credentials JSON file
   - Save it as `credentials.json` in the tool directory

4. **Configure the tool:**
   ```bash
   gdrive-dataset-manager config-info  # Check current configuration
   # Edit config.yaml with your Google Drive folder ID
   ```

## Quick Start

### 1. Setup Authentication
```bash
gdrive-dataset-manager auth
```

### 2. List Available Datasets
```bash
# List all datasets
gdrive-dataset-manager list

# List with detailed information
gdrive-dataset-manager list --details

# Search for specific datasets
gdrive-dataset-manager list --search "training"
```
gdrive-dataset-manager list --search "mental_health"
```

### 3. Download Datasets
```bash
# Download a specific dataset
gdrive-dataset-manager download "mental_health_conversations"

# Download to custom location
gdrive-dataset-manager download "dataset_name" --destination "/path/to/custom/location"

# Download and verify
gdrive-dataset-manager download "dataset_name" --verify
```

### 4. Upload Datasets
```bash
# Upload a local dataset
gdrive-dataset-manager upload "./ai/datasets/new_dataset"

# Upload with custom name
gdrive-dataset-manager upload "./local/data" --name "custom_dataset_name"

# Upload to specific folder
gdrive-dataset-manager upload "./data" --folder "processed_datasets"

# Upload without compression
gdrive-dataset-manager upload "./data" --no-compress
```

## Configuration

The tool uses a `config.yaml` file for configuration. Here's the structure:

```yaml
google_drive:
  # Your Google Drive folder ID where datasets are stored
  folder_id: "YOUR_GOOGLE_DRIVE_FOLDER_ID"
  
  # Path to your Google API credentials JSON file
  credentials_file: "credentials.json"
  
  # Application name for Google API
  application_name: "Pixelated Dataset Manager"

local:
  # Local path to datasets directory
  datasets_path: "../../ai/datasets"
  
  # Local path to processed data directory
  processed_path: "../../ai/data/processed"
  
  # Temporary download directory
  temp_path: "./temp"

download:
  # Chunk size for downloads (in bytes)
  chunk_size: 1048576  # 1MB
  
  # Maximum retries for failed downloads
  max_retries: 3
  
  # Timeout for download operations (seconds)
  timeout: 300

upload:
  # Chunk size for uploads (in bytes)
  chunk_size: 1048576  # 1MB
  
  # Maximum file size for upload (in bytes)
  max_file_size: 10737418240  # 10GB
  
  # Compress datasets before upload
  compress: true

logging:
  # Log level: DEBUG, INFO, WARNING, ERROR
  level: "INFO"
  
  # Log file path
  file: "gdrive_manager.log"
  
  # Max log file size (bytes)
  max_file_size: 10485760  # 10MB
  
  # Number of backup log files
  backup_count: 5
```

## Commands Reference

### Authentication
```bash
# Setup or refresh authentication
gdrive-dataset-manager auth
```

### Listing Datasets
```bash
# Basic listing
gdrive-dataset-manager list

# With detailed information
gdrive-dataset-manager list --details

# Search for datasets
gdrive-dataset-manager list --search "keyword"
```

### Downloading
```bash
# Download dataset
gdrive-dataset-manager download DATASET_NAME

# Custom destination
gdrive-dataset-manager download DATASET_NAME --destination PATH

# Verify after download
gdrive-dataset-manager download DATASET_NAME --verify
```

### Uploading
```bash
# Upload file or directory
gdrive-dataset-manager upload LOCAL_PATH

# Custom name
gdrive-dataset-manager upload LOCAL_PATH --name "Custom Name"

# Upload to specific folder
gdrive-dataset-manager upload LOCAL_PATH --folder "folder_name"

# Control compression
gdrive-dataset-manager upload LOCAL_PATH --compress
gdrive-dataset-manager upload LOCAL_PATH --no-compress
```

### Utilities
```bash
# Check configuration
gdrive-dataset-manager config-info

# Check storage quota
gdrive-dataset-manager quota

# Clean up temporary files
gdrive-dataset-manager cleanup
gdrive-dataset-manager cleanup --all
```

## Advanced Usage

### Batch Operations

You can create scripts for batch operations:

```python
from gdrive_dataset_manager import ConfigManager, DriveAuthenticator, DatasetDownloader

# Setup
config = ConfigManager()
auth = DriveAuthenticator(str(config.get_credentials_path()))
auth.authenticate()
downloader = DatasetDownloader(auth, config.to_dict())

# Download multiple datasets
datasets = [
    {"id": "dataset_id_1", "name": "dataset1"},
    {"id": "dataset_id_2", "name": "dataset2"}
]

results = downloader.download_multiple_datasets(datasets)
```

### Custom Configuration

You can use environment variables or custom config files:

```bash
# Use custom config file
gdrive-dataset-manager --config custom_config.yaml list

# Debug mode
gdrive-dataset-manager --debug download dataset_name
```

## Google Drive Setup

### Getting Your Folder ID

1. Open Google Drive in your browser
2. Navigate to the folder where you want to store datasets
3. Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
4. Copy the folder ID and put it in your `config.yaml`

### Setting Up API Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** (or select existing)
3. **Enable APIs**:
   - Search for "Google Drive API"
   - Click "Enable"
4. **Create Credentials**:
   - Go to "Credentials" in the sidebar
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Desktop application"
   - Download the JSON file
   - Rename it to `credentials.json`
5. **Configure OAuth consent screen** if prompted

## Security Considerations

- **Credentials**: Never commit `credentials.json` or `token.json` to version control
- **Authentication**: The tool stores authentication tokens locally in `token.json`
- **Permissions**: The tool requests only Google Drive access permissions
- **Data**: All data transfer is encrypted via Google's APIs

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```bash
   # Re-run authentication
   gdrive-dataset-manager auth
   ```

2. **Folder Not Found**
   - Verify the folder ID in `config.yaml`
   - Ensure you have access to the folder

3. **Quota Exceeded**
   ```bash
   # Check available space
   gdrive-dataset-manager quota
   ```

4. **Large File Upload Fails**
   - Check `upload.max_file_size` in config
   - Ensure stable internet connection
   - Try enabling compression

### Debug Mode

Enable debug mode for detailed logging:

```bash
gdrive-dataset-manager --debug COMMAND
```

### Log Files

Check `gdrive_manager.log` for detailed operation logs.

## File Structure

```
gdrive-dataset-manager/
├── cli.py           # Main CLI interface
├── auth.py                 # Authentication handling
├── config_manager.py       # Configuration management
├── lister.py              # Dataset listing functionality
├── downloader.py          # Download functionality
├── uploader.py            # Upload functionality
├── requirements.txt       # Python dependencies
├── config.yaml           # Configuration file
├── credentials.json      # Google API credentials (not in repo)
├── token.json           # Auth token (generated automatically)
├── gdrive_manager.log   # Log file
└── temp/               # Temporary files directory
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This tool is part of the Pixelated Empathy project. See the main project license for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the log files
3. Enable debug mode for detailed output
4. Create an issue in the project repository
