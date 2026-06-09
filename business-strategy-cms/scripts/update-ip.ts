import * as dotenv from 'dotenv'
import DigestFetch from 'digest-fetch'

function isResponse(value: unknown): value is Response {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "ok" in value &&
    "status" in value &&
    "statusText" in value &&
    "text" in value &&
    typeof (value as { ok: unknown }).ok === "boolean" &&
    typeof (value as { status: unknown }).status === "number" &&
    typeof (value as { statusText: unknown }).statusText === "string" &&
    typeof (value as { text: unknown }).text === "function"
  );
}

const PUBLIC_KEY = process.env.ATLAS_PUBLIC_KEY
const PRIVATE_KEY = process.env.ATLAS_PRIVATE_KEY
const GROUP_ID = process.env.ATLAS_GROUP_ID

if (!PUBLIC_KEY || !PRIVATE_KEY || !GROUP_ID) {
  console.log('\n❌ Missing Atlas API Credentials')
  console.log(
    'To automatically update your IP whitelist, add these to your .env file:',
  )
  console.log('ATLAS_PUBLIC_KEY=...')
  console.log('ATLAS_PRIVATE_KEY=...')
  console.log('ATLAS_GROUP_ID=...')
  console.log(
    '\nFind these in Atlas: Project Settings > Access Manager > API Keys',
  )
  console.log('Ensure the API Key has "Project Owner" permissions.\n')
  process.exit(1)
}

async function updateWhitelist() {
  try {
    // 1. Get current IP
    console.log('🔍 Fetching current public IP...')
    const client = new DigestFetch(
      PUBLIC_KEY!,
      PRIVATE_KEY!,
    )

    // We can't use axios for ipify essentially, but let's just use regular fetch or keeping it simple
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const ipText = await ipRes.text()
    const ipMatch = /"ip"\s*:\s*"([^"]+)"/.exec(ipText)
    if (!ipMatch) {
      throw new Error('Failed to resolve current public IP')
    }
    const ip = ipMatch[1]

    console.log(`📍 Current IP: ${ip}`)

    // 2. Add to Atlas
    console.log('🚀 Adding to Atlas Whitelist...')
    const url = `https://cloud.mongodb.com/api/atlas/v1.0/groups/${GROUP_ID!}/accessList`

    const payload = [
      {
        ipAddress: ip,
        comment: `Auto-added via CLI: ${new Date().toISOString()}`,
      },
    ]

    const response: unknown = await client.fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    if (!isResponse(response)) {
      throw new Error("Unexpected Atlas API response type");
    }

    if (response.ok) {
      console.log('✅ IP successfully added to whitelist!')
      console.log('⏳ It may take 1-2 minutes to propagate.')
    } else {
      console.error(
        '❌ Failed to update whitelist:',
        response.status,
        response.statusText,
      )
      const errBody = await response.text()
      console.error(errBody)
    }
  } catch (err) {
    console.error('❌ Script failed:', err)
  }
}

void updateWhitelist()