import type { Database } from '../../types/supabase'
import { createAuditLog } from '../audit'
import { supabase, supabaseAdmin } from '../supabase'
import { updateConversation } from './conversations'

export type Message = Database['public']['Tables']['messages']['Row']
export type NewMessage = Database['public']['Tables']['messages']['Insert']
export type UpdateMessage = Database['public']['Tables']['messages']['Update']

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  limit = 50,
  offset = 0,
): Promise<Message[]> {
  // First verify the user has access to this conversation
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()

  if (conversationError || !conversation) {
    console.error('Error verifying conversation access:', conversationError)
    throw new Error('Unauthorized access to conversation')
  }

  // Then get the messages
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching messages:', error)
    throw new Error('Failed to fetch messages')
  }

  return data || []
}

/**
 * Create a new message
 */
export async function createMessage(
  message: NewMessage,
  userId: string,
  request?: Request,
): Promise<Message> {
  // First verify the user has access to this conversation
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, user_id')
    .eq('id', message.conversation_id)
    .eq('user_id', userId)
    .single()

  if (conversationError || !conversation) {
    console.error('Error verifying conversation access:', conversationError)
    throw new Error('Unauthorized access to conversation')
  }

  // Create the message
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single()

  if (error) {
    console.error('Error creating message:', error)
    throw new Error('Failed to create message')
  }

  // Update the conversation's last_message_at timestamp
  await updateConversation(message.conversation_id, userId, {
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // Log the event for HIPAA compliance
  await createAuditLog({
    userId,
    action: 'message_created',
    resource: 'messages',
    metadata: {
      messageId: data.id,
      conversationId: message.conversation_id,
      role: message.role,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return data
}

/**
 * Update a message (e.g., for flagging content)
 */
export async function updateMessage(
  id: string,
  conversationId: string,
  userId: string,
  updates: UpdateMessage,
  request?: Request,
): Promise<Message> {
  // First verify the user has access to this conversation
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()

  if (conversationError || !conversation) {
    console.error('Error verifying conversation access:', conversationError)
    throw new Error('Unauthorized access to conversation')
  }

  // Update the message
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .eq('conversation_id', conversationId)
    .select()
    .single()

  if (error) {
    console.error('Error updating message:', error)
    throw new Error('Failed to update message')
  }

  // Log the event for HIPAA compliance
  await createAuditLog({
    userId,
    action: 'message_updated',
    resource: 'messages',
    metadata: {
      messageId: id,
      conversationId,
      updates,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return data
}

/**
 * Flag a message for review (e.g., harmful content)
 */
export async function flagMessage(
  id: string,
  conversationId: string,
  userId: string,
  reason: string,
  request?: Request,
): Promise<Message> {
  const updates: UpdateMessage = {
    is_flagged: true,
    metadata: {
      flagged_at: new Date().toISOString(),
      flagged_by: userId,
      reason,
    },
  }

  return updateMessage(id, conversationId, userId, updates, request)
}

/**
 * Admin function to get all flagged messages (for staff/admin only)
 */
export async function adminGetFlaggedMessages(): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*, conversations(title, user_id)')
    .eq('is_flagged', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching flagged messages:', error)
    throw new Error('Failed to fetch flagged messages')
  }

  return data || []
}
