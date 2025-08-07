import { Resend } from 'resend'
import { getEnv, isEnvTrue } from '@/lib/utils/env'

// Initialize logger (need to fix the logger import and type)
// TODO: Fix logger import
const logger = console // Temporary replacement until logger is properly imported

const resendApiKey = getEnv('RESEND_API_KEY')
if (!resendApiKey) {
  throw new Error('Missing required Resend API key')
}

const resend = new Resend(resendApiKey)

// Security configuration from environment with proper types
interface SecurityConfig {
  maxLoginAttempts: number
  lockoutDuration: number
  enableBruteForceProtection: boolean
  enableAlerts: boolean
  defaultSecurityLevel: 'standard' | 'high' | 'maximum'
}

const SECURITY_CONFIG: SecurityConfig = {
  maxLoginAttempts: Number(import.meta.env['SECURITY_MAX_LOGIN_ATTEMPTS']) || 5,
  lockoutDuration:
    Number(import.meta.env['SECURITY_ACCOUNT_LOCKOUT_DURATION']) || 1800,
  enableBruteForceProtection:
    isEnvTrue('SECURITY_ENABLE_BRUTE_FORCE_PROTECTION'),
  enableAlerts: isEnvTrue('SECURITY_ENABLE_ALERTS'),
  defaultSecurityLevel: 'standard',
}

interface SecuritySettings {
  userId: string
  enhancedSecurity: boolean
  securityLevel: 'standard' | 'high' | 'maximum'
  notificationPreferences: {
    login_from_new_device: boolean
    password_changes: boolean
    failed_login_attempts: boolean
    suspicious_activity: boolean
  }
}

// Event data type definitions
interface SecurityEventData {
  device?: string
  location?: string
  ipAddress?: string
  timestamp?: string
  attemptCount?: number
  activityType?: string
  details?: string
}

// Helper function to validate and transform event data
function validateEventData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || !data) {
    throw new Error('Invalid event data: must be an object')
  }
  return data as Record<string, unknown>
}

/** Stub: Configure security alerts (no-op) */
export async function configureSupabaseSecurityAlerts(): Promise<boolean> {
  console.warn('Stub: configureSupabaseSecurityAlerts – no-op')
  return true
}

/** Stub: Enable enhanced security monitoring (no-op) */
export async function enableEnhancedSecurityMonitoring(
  userId: string,
): Promise<void> {
  console.warn(`Stub: enableEnhancedSecurityMonitoring(${userId}) – no-op`)
}

/** Stub: Test security alert (no-op) */
export async function testSecurityAlert(
  alertType: 'suspicious_login' | 'password_reset' | 'account_locked',
): Promise<boolean> {
  console.warn(`Stub: testSecurityAlert(${alertType}) – no-op`)
  return true
}

/** Stub: Get user security settings (no-op) */
export async function getUserSecuritySettings(
  userId: string,
): Promise<any> {
  console.warn(`Stub: getUserSecuritySettings(${userId}) – returning null`)
  return null
}

// Update the sendSecurityEmail function with proper typing
async function sendSecurityEmail(
  templateName: string,
  userId: string,
  templateData: Record<string, unknown>,
): Promise<boolean> {
  try {
    // Get user's email from Supabase with proper typing
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError) {
      throw userError
    }
    if (!userData?.email) {
      throw new Error('User email not found')
    }

    // Get template from database with proper typing
    interface EmailTemplate {
      name: string
      subject: string
      html_content: string
      text_content: string
    }

    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select<'*', EmailTemplate>('*')
      .eq('name', templateName)
      .single()

    if (templateError) {
      throw templateError
    }
    if (!template) {
      throw new Error('Email template not found')
    }

    const emailFrom = process.env.EMAIL_FROM || 'send@pixelatedempathy.com'

    // Send email using Resend with proper typing
    await resend.emails.send({
      from: emailFrom,
      to: userData.email,
      subject: template.subject,
      html: template.html_content,
      text: template.text_content,
      tags: [
        { name: 'template', value: templateName },
        { name: 'category', value: 'security' },
      ],
    })

    logger.info(`Security email sent: ${templateName} to user ${userId}`)
    return true
  } catch (error) {
    logger.error('Failed to send security email:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Test security alert system
export async function testSecurityAlertSystem(
  userId: string,
): Promise<boolean> {
  try {
    const testData = {
      device: 'Test Device',
      location: 'Test Location',
      ip_address: '127.0.0.1',
      timestamp: new Date().toISOString(),
    }

    await sendSecurityEmail('new_device_login', userId, testData)
    return true
  } catch (error) {
    logger.error('Failed to test security alert:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Handle new device login
export async function handleNewDeviceLogin(
  userId: string,
  deviceInfo: {
    device: string
    location: string
    ipAddress: string
  },
): Promise<void> {
  try {
    const settings = await getUserSecuritySettings(userId)

    if (settings.notificationPreferences.login_from_new_device) {
      await sendSecurityEmail(
        'new_device_login',
        userId,
        validateEventData({
          device: deviceInfo.device,
          location: deviceInfo.location,
          ip_address: deviceInfo.ipAddress,
          timestamp: new Date().toISOString(),
        }),
      )
    }

    // Log the new device login
    const eventData: SecurityEventData = {
      ...deviceInfo,
      timestamp: new Date().toISOString(),
    }

    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'new_device_login',
      event_data: validateEventData(eventData),
    })
  } catch (error) {
    logger.error('Failed to handle new device login:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Handle failed login attempts
export async function handleFailedLoginAttempt(
  userId: string,
  attemptInfo: {
    location: string
    ipAddress: string
    attemptCount: number
  },
): Promise<void> {
  try {
    const settings = await getUserSecuritySettings(userId)

    if (
      settings.notificationPreferences.failed_login_attempts &&
      attemptInfo.attemptCount >= SECURITY_CONFIG.maxLoginAttempts
    ) {
      await sendSecurityEmail(
        'failed_login_attempts',
        userId,
        validateEventData({
          attempt_count: attemptInfo.attemptCount,
          location: attemptInfo.location,
          timestamp: new Date().toISOString(),
          lockout_duration: SECURITY_CONFIG.lockoutDuration,
        }),
      )
    }

    // Log the failed attempt
    const eventData: SecurityEventData = {
      ...attemptInfo,
      timestamp: new Date().toISOString(),
    }

    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'failed_login_attempt',
      event_data: validateEventData(eventData),
    })
  } catch (error) {
    logger.error('Failed to handle failed login attempt:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Handle password change
export async function handlePasswordChange(
  userId: string,
  changeInfo: {
    device: string
    location: string
  },
): Promise<void> {
  try {
    const settings = await getUserSecuritySettings(userId)

    if (settings.notificationPreferences.password_changes) {
      await sendSecurityEmail(
        'password_changed',
        userId,
        validateEventData({
          device: changeInfo.device,
          location: changeInfo.location,
          timestamp: new Date().toISOString(),
        }),
      )
    }

    // Log the password change
    const eventData: SecurityEventData = {
      ...changeInfo,
      timestamp: new Date().toISOString(),
    }

    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'password_changed',
      event_data: validateEventData(eventData),
    })
  } catch (error) {
    logger.error('Failed to handle password change:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Handle suspicious activity
export async function handleSuspiciousActivity(
  userId: string,
  activityInfo: {
    activityType: string
    location: string
    details: string
  },
): Promise<void> {
  try {
    const settings = await getUserSecuritySettings(userId)

    if (settings.notificationPreferences.suspicious_activity) {
      await sendSecurityEmail(
        'suspicious_activity',
        userId,
        validateEventData({
          activity_type: activityInfo.activityType,
          location: activityInfo.location,
          details: activityInfo.details,
          timestamp: new Date().toISOString(),
        }),
      )
    }

    // Log the suspicious activity
    const eventData: SecurityEventData = {
      ...activityInfo,
      timestamp: new Date().toISOString(),
    }

    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'suspicious_activity',
      event_data: validateEventData(eventData),
    })
  } catch (error) {
    logger.error('Failed to handle suspicious activity:', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Export the supabase client for use in other modules
export { supabase }
