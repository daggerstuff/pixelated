// ... (previous code remains unchanged)

import { supabase } from '../supabase/client'

// Define the structure for the transformed audit log entry
export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: {
    id: string
    type: string | undefined // type is consistently undefined in the new mapping
  }
  metadata: Record<string, unknown> // Corresponds to 'details' from the raw log
  timestamp: Date // Corresponds to 'created_at' from the raw log
}

// Define the structure for raw log data from Supabase
// Based on fields accessed: id, user_id, action, resource, details, created_at
interface RawAuditLogFromSupabase {
  id: string
  user_id: string
  action: string
  resource: string // This seems to be just a string ID now
  details: Record<string, unknown>
  created_at: string // Supabase timestamps are typically strings
  [key: string]: unknown // Changed from any to unknown
}

export async function getUserAuditLogs(
  userId: string,
  limit = 100,
  offset = 0,
): Promise<AuditLogEntry[]> {
  try {
    // Get the audit logs
    const result = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    const { data, error } = result

    if (error) {
      console.error('Error getting user audit logs:', error)
      return []
    }

    // Transform the data to match our interface
    return (data || []).map((log: RawAuditLogFromSupabase) => ({
      id: log.id,
      userId: log.user_id,
      action: log.action,
      resource: {
        id: log.resource,
        type: undefined,
      },
      metadata: log.details,
      timestamp: new Date(log.created_at),
    }))
  } catch (error) {
    console.error('Error getting user audit logs:', error)
    return []
  }
}

export async function getActionAuditLogs(
  action: string,
  limit = 100,
  offset = 0,
): Promise<AuditLogEntry[]> {
  try {
    // Get the audit logs
    const result = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    const { data, error } = result

    if (error) {
      console.error('Error getting audit logs:', error)
      return []
    }

    // Transform the data to match our interface
    return (data || []).map((log: RawAuditLogFromSupabase) => ({
      id: log.id,
      userId: log.user_id,
      action: log.action,
      resource: {
        id: log.resource,
        type: undefined,
      },
      metadata: log.details,
      timestamp: new Date(log.created_at),
    }))
  } catch (error) {
    console.error('Error getting audit logs:', error)
    return []
  }
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const result = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
  const { data, error } = result

  if (error) {
    console.error('Error getting audit logs:', error)
    return []
  }

  return (data || []).map((log: RawAuditLogFromSupabase) => ({
    id: log.id,
    timestamp: new Date(log.created_at),
    action: log.action,
    userId: log.user_id,
    resource: {
      id: log.resource,
      type: undefined,
    },
    metadata: log.details,
  }))
}
