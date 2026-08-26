import type { Database } from '../../types/supabase'
import { createAuditLog, AuditEventType } from '../audit'
import { getRequestHeader } from '../utils/request-headers'
import { mongoClient } from './mongoClient'

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type NewConversation =
  Database['public']['Tables']['conversations']['Insert']
export type UpdateConversation =
  Database['public']['Tables']['conversations']['Update']

/**
 * Get all conversations for a user
 */
export async function getConversations(
  userId: string,
): Promise<Conversation[]> {
  const conversations = await mongoClient.db
    .collection('conversations')
    .find({ user_id: userId })
    .sort({ last_message_at: -1 })
    .toArray()

  return conversations as unknown as Conversation[]
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(
  id: string,
  userId: string,
): Promise<Conversation | null> {
  const { ObjectId } = await import('mongodb')
  const conversation = await mongoClient.db
    .collection('conversations')
    .findOne({ _id: new ObjectId(id), user_id: userId })

  return conversation as unknown as Conversation | null
}

/**
 * Get conversations linked to a therapy session
 */
export async function getConversationsBySessionId(
  sessionId: string,
): Promise<Conversation[]> {
  const conversations = await mongoClient.db
    .collection('conversations')
    .find({ session_id: sessionId })
    .sort({ created_at: 1 })
    .toArray()

  return conversations as unknown as Conversation[]
}

/**
 * Create a new conversation
 */
export async function createConversation(
  conversation: NewConversation,
  request?: Request,
): Promise<Conversation> {
  const result = await mongoClient.db
    .collection('conversations')
    .insertOne(conversation as unknown as Record<string, unknown>)

  const newConversation = {
    ...conversation,
    _id: result.insertedId,
    id: result.insertedId.toHexString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  }

  // Log the event for HIPAA compliance
  await createAuditLog(
    AuditEventType.CREATE,
    'conversation_created',
    conversation.user_id,
    'conversations',
    {
      conversationId: newConversation._id.toHexString(),
      title: conversation.title,
      ipAddress: getRequestHeader(request, 'x-forwarded-for'),
      userAgent: getRequestHeader(request, 'user-agent'),
    },
  )

  return newConversation as unknown as Conversation
}

/**
 * Update a conversation
 */
export async function updateConversation(
  id: string,
  userId: string,
  updates: UpdateConversation,
  request?: Request,
): Promise<Conversation> {
  const { ObjectId } = await import('mongodb')
  const result = await mongoClient.db
    .collection('conversations')
    .findOneAndUpdate(
      { _id: new ObjectId(id), user_id: userId },
      { $set: updates },
      { returnDocument: 'after' },
    )

  if (!result?.['value']) {
    throw new Error('Failed to update conversation')
  }

  // Log the event for HIPAA compliance
  await createAuditLog(
    AuditEventType.MODIFY,
    'conversation_updated',
    userId,
    'conversations',
    {
      conversationId: id,
      updates,
      ipAddress: getRequestHeader(request, 'x-forwarded-for'),
      userAgent: getRequestHeader(request, 'user-agent'),
    },
  )

  return result['value']
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  id: string,
  userId: string,
  request?: Request,
): Promise<void> {
  const { ObjectId } = await import('mongodb')
  const result = await mongoClient.db
    .collection('conversations')
    .deleteOne({ _id: new ObjectId(id), user_id: userId })

  if (result.deletedCount === 0) {
    throw new Error('Failed to delete conversation')
  }

  // Log the event for HIPAA compliance
  await createAuditLog(
    AuditEventType.DELETE,
    'conversation_deleted',
    userId,
    'conversations',
    {
      conversationId: id,
      ipAddress: getRequestHeader(request, 'x-forwarded-for'),
      userAgent: getRequestHeader(request, 'user-agent'),
    },
  )
}

/**
 * Admin function to get all conversations (for staff/admin only)
 */
export async function adminGetAllConversations(): Promise<Conversation[]> {
  const conversations = await mongoClient.db
    .collection('conversations')
    .find()
    .sort({ created_at: -1 })
    .toArray()

  return conversations as unknown as Conversation[]
}
