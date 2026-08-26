import {
  httpBasic,
  localDev,
  placeholderAuth,
  vercelOidc,
} from 'eve/channels/auth'
import { eveChannel } from 'eve/channels/eve'

const authUsername = process.env.EVE_AUTH_USERNAME
const authPassword = process.env.EVE_AUTH_PASSWORD

export default eveChannel({
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // HTTP Basic auth for self-hosted production. Requires EVE_AUTH_USERNAME
    // and EVE_AUTH_PASSWORD env vars. Falls back to placeholderAuth (401)
    // when credentials are not configured — fail closed, never open.
    authUsername && authPassword
      ? httpBasic({ username: authUsername, password: authPassword })
      : placeholderAuth(),
  ],
})
