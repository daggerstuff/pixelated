# Google Drive + rclone: Secure Setup Guide

**Step 1: Create a Google API Project and OAuth credentials**
1. Go to: https://console.cloud.google.com/apis/dashboard (ensure you're logged in to the correct Google account).
2. Click 'Select a project' and then 'New project'. Name it (e.g., "Rclone Backup") and create.
3. At the project dashboard, click "Enable APIs and Services" and search for "Google Drive API". Enable it.
4. In the sidebar, go to "Credentials".
5. Click "+ Create Credentials" > "OAuth client ID".
6. Choose "Desktop app" (NOT web/server), give it a name, and create.
7. **Copy the Client ID and Client Secret** provided.

**Step 2: Run rclone config and enter your credentials**
- In terminal:
  ```
  rclone config
  ```
- New remote? `n`
- Name? (e.g.) `gdrive`
- Storage type? Enter the corresponding number for `Google Drive`
- Client ID? (Paste from above)
- Client Secret? (Paste from above)
- Scope? Full drive access (recommended)
- Leave other options default/blank unless you know otherwise.
- Auto config "y": this will open a browser; log in with your Google account, approve.

**Step 3: Test your remote**
- List files/folders:  
  ```
  rclone lsd gdrive:
  ```

You are now ready to use rclone (mount or sync).  
_Next step_: Tell me the name you chose for your remote (e.g., `gdrive`), and I will write a robust sync script for your HOME directory.