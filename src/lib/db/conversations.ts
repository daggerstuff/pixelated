import type { Database } from '../../types/supabase'
import { createAuditLog } from '../audit'
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

  return conversations as Conversation[]
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(
  id: string,
  userId: string,
): Promise<Conversation | null> {
  const conversation = await mongoClient.db
    .collection('conversations')
    .findOne({ _id: id, user_id: userId })

  return conversation as Conversation | null
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
    .insertOne(conversation)

  const newConversation = {
    ...conversation,
    _id: result.insertedId,
  }

  // Log the event for HIPAA compliance
  await createAuditLog({
    userId: conversation.user_id,
    action: 'conversation_created',
    resource: 'conversations',
    metadata: {
      conversationId: newConversation._id.toHexString(),
      title: conversation.title,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return newConversation as Conversation
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
  const result = await mongoClient.db
    .collection('conversations')
    .findOneAndUpdate(
      { _id: id, user_id: userId },
      { $set: updates },
      { returnDocument: 'after' },
    )

  if (!result.value) {
    throw new Error('Failed to update conversation')
  }

  // Log the event for HIPAA compliance
  await createAuditLog({
    userId,
    action: 'conversation_updated',
    resource: 'conversations',
    metadata: {
      conversationId: id,
      updates,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return result.value as Conversation
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  id: string,
  userId: string,
  request?: Request,
): Promise<void> {
  const result = await mongoClient.db
    .collection('conversations')
    .deleteOne({ _id: id, user_id: userId })

  if (result.deletedCount === 0) {
    throw new Error('Failed to delete conversation')
  }

  // Log the event for HIPAA compliance
  await createAuditLog({
    userId,
    action: 'conversation_deleted',
    resource: 'conversations',
    metadata: {
      conversationId: id,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })
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

  return conversations as Conversation[]
}
