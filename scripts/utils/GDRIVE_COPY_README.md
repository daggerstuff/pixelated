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
   - Choose **"Desktop app"** as application type
   - **IMPORTANT**: Download the credentials JSON file **immediately** - Google only shows the client secret once at creation time!
   - Save it as: `~/.config/gdrive_copy/credentials.json`
   
   **⚠️ If you've lost your client secret:**
   - Go to your OAuth 2.0 Client ID in Google Cloud Console
   - Click "Add Secret" to create a new client secret
   - Download the updated credentials.json immediately
   - Replace your old `~/.config/gdrive_copy/credentials.json` with the new one
   - See [Google's documentation](https://support.google.com/cloud/answer/15549257#client-secret-hashing) for details

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

**"(invalid_client) Unauthorized"**
- Your OAuth credentials may be invalid, expired, or the client secret was lost
- **If you've lost your client secret** (most common):
  - Go to [Google Cloud Console](https://console.cloud.google.com/) → Google Auth Platform → Clients
  - Click on your OAuth 2.0 Client ID
  - Click **"Add Secret"** to create a new client secret
  - **Download the updated credentials.json immediately** (Google only shows secrets once!)
  - Replace `~/.config/gdrive_copy/credentials.json` with the new file
- **If creating a new client:**
  - Delete the old OAuth 2.0 Client ID and create a new one
  - Make sure to select **"Desktop app"** as the application type
  - Download the `credentials.json` immediately after creation
  - Ensure **Google Drive API is enabled** in your project
- **Note**: Google now hashes client secrets - you can only view/download them once at creation time. See [Google's documentation](https://support.google.com/cloud/answer/15549257#client-secret-hashing)

**"Permission denied"**
- Ensure the source account has access to the file
- Check that both accounts have Drive API enabled

**"File not found"**
- Verify the file ID is correct
- Ensure the source account can access the file

## Correct Command Usage

**Wrong:**
```bash
uv python scripts/utils/gdrive_copy.py ...  # ❌ This is for managing Python versions
```

**Correct:**
```bash
uv run python scripts/utils/gdrive_copy.py ...  # ✅ Run in uv environment
```

Or if you're already in a uv shell:
```bash
python scripts/utils/gdrive_copy.py ...  # ✅ Direct execution
```
