# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-30

### Added
- Initial release of Google Drive Dataset Manager
- Complete OAuth2 authentication with Google Drive API
- Dataset listing with rich formatting and file type filtering
- Recursive dataset download with progress tracking
- Dataset upload with automatic compression and quota checking
- Configuration management with YAML-based settings
- Professional CLI interface with comprehensive error handling
- Logging system with configurable levels
- Quota monitoring and storage management
- Cleanup utilities for managing temporary files
- UV environment support for isolated dependencies
- Comprehensive documentation and setup guides

### Features
- **Authentication**: Secure OAuth2 flow with persistent token storage
- **Listing**: Browse datasets with metadata, sizes, and creation dates
- **Download**: Parallel downloads with verification and resume capability
- **Upload**: Automatic compression with progress tracking
- **Configuration**: Flexible YAML configuration with validation
- **Monitoring**: Real-time progress bars and quota tracking
- **Error Handling**: Robust error recovery and user-friendly messages

### Technical Details
- Built with Python 3.11+ using modern async/await patterns
- Google Drive API v3 integration
- Click framework for CLI interface
- Rich library for beautiful terminal output
- YAML configuration management
- Comprehensive logging and error handling
