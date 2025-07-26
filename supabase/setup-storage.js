import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase URL or service role key in environment variables',
  )
  process.exit(1)
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Function to set up storage buckets
async function setupStorageBuckets() {
  try {
    console.log('Setting up storage buckets...')

    // Define the buckets to create
    const buckets = [
      { name: 'avatars', public: true },
      { name: 'attachments', public: false },
      { name: 'app-assets', public: true },
      { name: 'templates', public: false },
    ]

    // Create each bucket
    const bucketPromises = buckets.map(async (bucket) => {
      console.log(`Creating bucket: ${bucket.name}`)

      // Create the bucket
      const { error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52428800, // 50MB
      })

      if (error && error.message !== 'Bucket already exists') {
        console.error(`Error creating bucket ${bucket.name}:`, error)
      } else {
        console.log(`Successfully created bucket: ${bucket.name}`)

        // Set up bucket permissions
        if (bucket.public) {
          const { error: policyError } = await supabase.rpc(
            'create_storage_policy',
            {
              bucket_name: bucket.name,
              policy_name: `${bucket.name}_public_select_policy`,
              definition:
                "auth.role() = 'anonymous' OR auth.role() = 'authenticated'",
              operation: 'SELECT',
            },
          )

          if (policyError) {
            console.warn(
              `Warning setting up public access policy for ${bucket.name}:`,
              policyError,
            )
          }
        }
      }
    })

    // Wait for all bucket operations to complete
    await Promise.all(bucketPromises)

    console.log('Storage bucket setup completed')
  } catch (error) {
    console.error('Storage bucket setup failed:', error)
  }
}

// Run the main function
setupStorageBuckets()
