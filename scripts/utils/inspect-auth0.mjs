try {
  const response = await fetch('https://test.auth0.com/.well-known/openid-configuration')
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(`Failed to load OpenID configuration: ${response.status}`)
  }

  console.log('--- OpenID configuration keys ---')
  console.log(Object.keys(payload))
} catch (e) {
  console.error(e)
}
