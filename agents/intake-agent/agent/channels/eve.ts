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
    localDev(),
    vercelOidc(),
    authUsername && authPassword
      ? httpBasic({ username: authUsername, password: authPassword })
      : placeholderAuth(),
  ],
})
