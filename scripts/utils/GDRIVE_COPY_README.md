# Google Drive Direct Copy Tool

Copy files directly between Google Drive accounts without downloading locally.

## Quick Start

1. **Install dependencies:**
   ```bash
   uv pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
   ```

2. **Set up Google Cloud credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select existing)
   - Enable the **Google Drive API**
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Desktop app" as application type
   - Download the credentials JSON file
   - Save it as: `~/.config/gdrive_copy/credentials.json`

3. **Run the script:**
   ```bash
   python scripts/utils/gdrive_copy.py 1eLzYK2cPQUZqOqtpGLBNLmwMRtJoQPJr
   ```

   Or with a full URL:
   ```bash
   python scripts/utils/gdrive_copy.py "https://drive.google.com/file/d/1eLzYK2cPQUZqOqtpGLBNLmwMRtJoQPJr/view?usp=sharing"
   ```

4. **First-time authentication:**
   - The script will open your browser twice:
     - First for the **source** Google account (where the file is)
     - Second for the **destination** Google account (where you want to copy it)
   - Grant permissions when prompted
   - Tokens are saved for future use

## Options

- `--destination-folder-id <id>`: Copy to a specific folder in destination Drive
- `--source-account <name>`: Label for source account (default: "Source")
- `--dest-account <name>`: Label for destination account (default: "Destination")

## Example with folder

```bash
python scripts/utils/gdrive_copy.py 1eLzYK2cPQUZqOqtpGLBNLmwMRtJoQPJr --destination-folder-id YOUR_FOLDER_ID
```

## How It Works

1. Authenticates with both Google accounts via OAuth2
2. Fetches file metadata from source Drive
3. Uses Drive API `files().copy()` to create a copy in destination Drive
4. No local download - all transfer happens in the cloud

## Token Storage

Authentication tokens are stored in:
- `~/.config/gdrive_copy/source_token.json` (source account)
- `~/.config/gdrive_copy/dest_token.json` (destination account)

These tokens persist, so you only need to authenticate once per account.

## Troubleshooting

**"Credentials file not found"**
- Make sure you've downloaded `credentials.json` from Google Cloud Console
- Save it to `~/.config/gdrive_copy/credentials.json`

**"Permission denied"**
- Ensure the source account has access to the file
- Check that both accounts have Drive API enabled

**"File not found"**
- Verify the file ID is correct
- Ensure the source account can access the file
