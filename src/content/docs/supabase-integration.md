---
title: "Supabase Integration Guide"
description: "Supabase Integration Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Supabase Integration Guide

## Access Tokens

### Format and Generation

Supabase access tokens always follow a specific format:
- They start with the prefix `sbp_`
- Followed by alphanumeric characters

To generate a valid access token:

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to Account → Access Tokens
3. Create a new access token with an appropriate name and expiration
4. Copy the generated token (it will only be shown once)

### Using Tokens with the CLI

When using the Supabase CLI, you can provide the access token in several ways:

1. Via environment variable:
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_1234567890abcdef
   supabase projects list
   ```

2. By storing in the access token file:
   ```bash
   mkdir -p ~/.supabase
   echo "sbp_1234567890abcdef" > ~/.supabase/access-token
   ```

3. Using the login command (interactive):
   ```bash
   supabase login
   ```

### Common Issues

1. **Invalid Token Format**:
   - Tokens must start with `sbp_`
   - If you receive an "Invalid access token format" error, check that you've copied the entire token

2. **Unknown project ID**:
   - Make sure you're using the correct project reference ID
   - Find it in your Supabase dashboard under Project Settings → General

3. **Configuration Warnings**:
   - When linking to a project, you may see warnings about unknown configuration fields
   - Use `--ignore-config-warnings` flag to suppress these

## GitHub Actions Integration

When using Supabase with GitHub Actions, follow these best practices:

1. Store your Supabase access token as a repository secret:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add a new repository secret named `SUPABASE_ACCESS_TOKEN`
   - Paste the value starting with `sbp_`

2. Also add these required database secrets:
   - `SUPABASE_PROJECT_ID` - Your project reference ID
   - `SUPABASE_DB_PASSWORD` - Database password
   - `SUPABASE_DB_HOST` - Database host URL
   - `SUPABASE_DB_USER` - Database username
   - `SUPABASE_DB_NAME` - Database name

3. Make sure to use proper validation in your workflows:
   ```yaml
   - name: Validate Supabase token format
     run: |
       if [[ ! "${{ secrets.SUPABASE_ACCESS_TOKEN }}" =~ ^sbp_ ]]; then
         echo "::error::Invalid access token format. Must start with 'sbp_'."
         exit 1
       fi
   ```

## Troubleshooting

If you encounter issues with Supabase CLI commands:

1. Verify your token with:
   ```bash
   ./scripts/validate-supabase-token.sh
   ```

2. Test basic connectivity:
   ```bash
   supabase projects list
   ```

3. Check CLI version:
   ```bash
   supabase --version
   ```

4. For database backup issues, verify PostgreSQL connection:
   ```bash
   PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h $SUPABASE_DB_HOST -U $SUPABASE_DB_USER -d $SUPABASE_DB_NAME -c "SELECT version();"
   ```

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/usage)
- [Database Backups Guide](https://supabase.com/docs/guides/platform/backups)
- [GitHub Actions Integration](https://supabase.com/docs/guides/integrations/github-actions)