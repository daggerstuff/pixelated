# MongoDB to Auth0 User Migration

This directory contains scripts to migrate users from the current MongoDB database to Auth0.

## Scripts

1. `migrate-users-to-auth0.js` - Node.js script that exports users from MongoDB in Auth0 import format
2. `migrate-users-to-auth0.sh` - Shell script that sets up environment and runs the migration

## Usage

```bash
# Run the migration script
./scripts/utils/migrate-users-to-auth0.sh
```

## What the script does

1. Connects to the MongoDB database using environment variables
2. Exports all users from the `users` collection
3. Transforms user data to match Auth0's bulk import format
4. Saves the transformed data to `auth0-users-export.json`

## Output Format

The script generates a JSON file with the following structure for each user:

```json
{
  "email": "user@example.com",
  "email_verified": true,
  "password": "TempPass123!",
  "connection": "Username-Password-Authentication",
  "user_metadata": {
    "role": "user",
    "created_at": "2023-01-01T00:00:00.000Z",
    "last_login": "2023-01-01T00:00:00.000Z",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "preferences": {}
  },
  "app_metadata": {
    "roles": ["User"],
    "imported_from": "mongodb"
  }
}
```

## Important Notes

1. **Passwords**: Since we cannot export plaintext passwords from MongoDB (they're hashed), the script sets a temporary password for all users. Users will need to reset their passwords after migration.

2. **Roles**: User roles are mapped to Auth0 roles:
   - `admin` → Admin
   - `therapist` → Therapist
   - `user` → User

3. **Email Verification**: The `emailVerified` field from MongoDB is preserved in the export.

## Next Steps After Migration

1. Import the generated JSON file into Auth0 using the Dashboard or Management API
2. Notify users to reset their passwords
3. Test the authentication flows with a few sample users
4. Update the application code to use Auth0 instead of the MongoDB authentication service