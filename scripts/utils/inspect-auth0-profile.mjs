try {
  const response = await fetch('https://test.auth0.com/.well-known/jwks.json')
  const payload = await response.json()
  console.log('keys:', payload.keys?.length ?? 0)
} catch (e) {
  console.error(e)
}
