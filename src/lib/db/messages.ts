import type { Database } from '../../types/supabase'
import { createAuditLog } from '../audit'
import { mongoClient } from './mongoClient'
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
  const conversation = await mongoClient.db
    .collection('conversations')
    .findOne({ _id: conversationId, user_id: userId })

  if (!conversation) {
    throw new Error('Unauthorized access to conversation')
  }

  // Then get the messages
  const messages = await mongoClient.db
    .collection('messages')
    .find({ conversation_id: conversationId })
    .sort({ created_at: -1 })
    .skip(offset)
    .limit(limit)
    .toArray()

  return messages as Message[]
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
  const conversation = await mongoClient.db
    .collection('conversations')
    .findOne({ _id: message.conversation_id, user_id: userId })

  if (!conversation) {
    throw new Error('Unauthorized access to conversation')
  }

  // Create the message
  const result = await mongoClient.db.collection('messages').insertOne(message)
  const newMessage = {
    ...message,
    _id: result.insertedId,
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
      messageId: newMessage._id.toHexString(),
      conversationId: message.conversation_id,
      role: message.role,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  })

  return newMessage as Message
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
  const conversation = await mongoClient.db
    .collection('conversations')
    .findOne({ _id: conversationId, user_id: userId })

  if (!conversation) {
    throw new Error('Unauthorized access to conversation')
  }

  // Update the message
  const result = await mongoClient.db
    .collection('messages')
    .findOneAndUpdate(
      { _id: id, conversation_id: conversationId },
      { $set: updates },
      { returnDocument: 'after' },
    )

  if (!result.value) {
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

  return result.value as Message
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
  const messages = await mongoClient.db
    .collection('messages')
    .aggregate([
      { $match: { is_flagged: true } },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversation_id',
          foreignField: '_id',
          as: 'conversations',
        },
      },
      { $unwind: '$conversations' },
      { $sort: { created_at: -1 } },
    ])
    .toArray()

  return messages as Message[]
}
