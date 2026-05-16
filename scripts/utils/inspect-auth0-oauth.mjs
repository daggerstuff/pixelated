try {
  const response = await fetch('https://test.auth0.com/authorize?response_type=code')
  console.log('--- OAuth endpoint status ---')
  console.log(response.status)
  console.log(response.headers.get('content-type'))
} catch (e) {
  console.error(e)
}
