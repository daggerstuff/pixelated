import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getEnv, isEnvTrue } from '@/lib/utils/env'

// Initialize logger (need to fix the logger import and type)
// TODO: Fix logger import
const logger = console // Temporary replacement until logger is properly imported

// Initialize Supabase client with proper error handling
const supabaseUrl = import.meta.env['PUBLIC_SUPABASE_URL']
const supabaseKey = import.meta.env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase configuration')
}

// Create Supabase client with admin privileges
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

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

/**
 * Configure Supabase's security alerts for suspicious authentication events
 */
export async function configureSupabaseSecurityAlerts(): Promise<boolean> {
  try {
    logger.info('Configuring Supabase security alerts')

    // Configure auth policies
    const { error: policiesError } = await supabase.rpc(
      'configure_auth_policies',
      {
        max_login_attempts: SECURITY_CONFIG.maxLoginAttempts,
        lockout_duration: SECURITY_CONFIG.lockoutDuration,
      },
    )

    if (policiesError) {
      throw policiesError
    }

    // Configure email templates for security notifications
    const { error: templatesError } = await supabase.rpc(
      'configure_security_templates',
    )

    if (templatesError) {
      throw templatesError
    }

    logger.info('Security alerts configuration applied successfully')
    return true
  } catch (error) {
    logger.error('Failed to configure Supabase security alerts', { error })
    throw error
  }
}

/**
 * Enable enhanced security monitoring for high-risk or privileged users
 */
export async function enableEnhancedSecurityMonitoring(
  userId: string,
): Promise<void> {
  try {
    logger.info(`Enabling enhanced security monitoring for user ${userId}`)

    const { data: user, error: userError } =
      await supabase.auth.admin.getUserById(userId)

    if (userError || !user) {
      throw userError || new Error('User not found')
    }

    // Update user metadata with enhanced security settings
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...user.user.user_metadata,
          enhanced_security_monitoring: true,
          security_monitoring_level: 'high',
          last_security_update: new Date().toISOString(),
          security_features: {
            two_factor_required: true,
            ip_whitelist_enabled: true,
            suspicious_activity_alerts: true,
          },
        },
      },
    )

    if (updateError) {
      throw updateError
    }

    // Set up real-time monitoring for this user
    await setupUserMonitoring(userId)

    logger.info(`Enhanced security monitoring enabled for user ${userId}`)
  } catch (error) {
    logger.error(
      `Failed to enable enhanced security monitoring for user ${userId}`,
      { error },
    )
    throw error
  }
}

/**
 * Test security alert functionality in a safe manner
 */
export async function testSecurityAlert(
  alertType: 'suspicious_login' | 'password_reset' | 'account_locked',
): Promise<boolean> {
  try {
    logger.info(`Testing security alert: ${alertType}`)

    // Use Supabase's test environment flag
    const { error } = await supabase.rpc('test_security_alert', {
      alert_type: alertType,
      is_test: true,
    })

    if (error) {
      throw error
    }

    logger.info(`Security alert test completed: ${alertType}`)
    return true
  } catch (error) {
    logger.error(`Failed to test security alert: ${alertType}`, { error })
    throw error
  }
}

/**
 * Get user's security settings and notification preferences
 */
export async function getUserSecuritySettings(
  userId: string,
): Promise<SecuritySettings> {
  try {
    logger.info(`Fetching security settings for user ${userId}`)

    const { data: user, error: userError } =
      await supabase.auth.admin.getUserById(userId)

    if (userError || !user) {
      throw userError || new Error('User not found')
    }

    const metadata = user.user.user_metadata || {}

    return {
      userId: userId,
      enhancedSecurity: metadata.enhanced_security_monitoring || false,
      securityLevel: metadata.security_monitoring_level || 'standard',
      notificationPreferences: {
        login_from_new_device:
          metadata.notification_preferences?.login_from_new_device ?? true,
        password_changes:
          metadata.notification_preferences?.password_changes ?? true,
        failed_login_attempts:
          metadata.notification_preferences?.failed_login_attempts ?? true,
        suspicious_activity:
          metadata.notification_preferences?.suspicious_activity ?? true,
      },
    }
  } catch (error) {
    logger.error(`Failed to fetch security settings for user ${userId}`, {
      error,
    })
    throw error
  }
}

/**
 * Update user's security settings and notification preferences
 */
export async function updateUserSecuritySettings(
  userId: string,
  settings: Partial<SecuritySettings>,
): Promise<void> {
  try {
    logger.info(`Updating security settings for user ${userId}`)

    const { data: user, error: userError } =
      await supabase.auth.admin.getUserById(userId)

    if (userError || !user) {
      throw userError || new Error('User not found')
    }

    const currentMetadata = user.user.user_metadata || {}

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...currentMetadata,
          enhanced_security_monitoring:
            settings.enhancedSecurity ??
            currentMetadata.enhanced_security_monitoring,
          security_monitoring_level:
            settings.securityLevel ?? currentMetadata.security_monitoring_level,
          security_notification_preferences: {
            ...currentMetadata.notification_preferences,
            ...settings.notificationPreferences,
          },
          last_security_update: new Date().toISOString(),
        },
      },
    )

    if (updateError) {
      throw updateError
    }

    // If security level is changed, update monitoring settings
    if (settings.securityLevel) {
      await updateSecurityMonitoring(userId, settings.securityLevel)
    }

    logger.info(`Security settings updated for user ${userId}`)
  } catch (error) {
    logger.error(`Failed to update security settings for user ${userId}`, {
      error,
    })
    throw error
  }
}

/**
 * Set up real-time monitoring for a user
 */
async function setupUserMonitoring(userId: string) {
  try {
    // Configure real-time monitoring rules
    const { error } = await supabase.rpc('setup_user_monitoring', {
      user_id: userId,
      monitoring_config: {
        track_ip_changes: true,
        track_device_changes: true,
        track_location_changes: true,
        alert_on_suspicious: true,
      },
    })

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error(`Failed to setup monitoring for user ${userId}`, { error })
    throw error
  }
}

/**
 * Update security monitoring based on security level
 */
async function updateSecurityMonitoring(
  userId: string,
  securityLevel: 'standard' | 'high' | 'maximum',
) {
  try {
    const monitoringConfig = {
      standard: {
        track_ip_changes: true,
        track_device_changes: true,
        alert_on_suspicious: true,
      },
      high: {
        track_ip_changes: true,
        track_device_changes: true,
        track_location_changes: true,
        alert_on_suspicious: true,
        require_2fa: true,
      },
      maximum: {
        track_ip_changes: true,
        track_device_changes: true,
        track_location_changes: true,
        alert_on_suspicious: true,
        require_2fa: true,
        ip_whitelist: true,
        session_timeout: 3600,
      },
    }

    const { error } = await supabase.rpc('update_security_monitoring', {
      user_id: userId,
      monitoring_config: monitoringConfig[securityLevel],
    })

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error(`Failed to update security monitoring for user ${userId}`, {
      error,
    })
    throw error
  }
}

// Update the sendSecurityEmail function with proper typing
async function sendSecurityEmail(
  templateName: string,
  userId: string,
  templateData: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { error: rpcError } = await supabase.rpc('send_security_email', {
      template_name: templateName,
      user_id: userId,
      template_data: templateData,
    })

    if (rpcError) {
      throw rpcError
    }

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
