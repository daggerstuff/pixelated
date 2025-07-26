interface UserAgentInfo {
  browser?: string
  os?: string
  device?: string
}

export function parseUserAgent(userAgent: string): UserAgentInfo {
  if (!userAgent) {
    return {}
  }

  const ua = userAgent.toLowerCase()
  const info: UserAgentInfo = {}

  // Browser detection
  if (ua.includes('firefox')) {
    info.browser = 'Firefox'
  } else if (ua.includes('edg')) {
    info.browser = 'Edge'
  } else if (ua.includes('chrome')) {
    info.browser = 'Chrome'
  } else if (ua.includes('safari')) {
    info.browser = 'Safari'
  }

  // OS detection
  if (ua.includes('windows')) {
    info.os = 'Windows'
  } else if (ua.includes('mac os')) {
    info.os = 'macOS'
  } else if (ua.includes('linux')) {
    info.os = 'Linux'
  } else if (ua.includes('android')) {
    info.os = 'Android'
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    info.os = 'iOS'
  }

  // Device detection
  if (ua.includes('mobile')) {
    info.device = 'Mobile'
  } else if (ua.includes('tablet')) {
    info.device = 'Tablet'
  } else {
    info.device = 'Desktop'
  }

  return info
}
