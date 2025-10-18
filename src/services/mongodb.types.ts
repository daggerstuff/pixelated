/**
 * MongoDB types for the adapter
 * This file provides type definitions for MongoDB operations
 */

// Use conditional import to prevent MongoDB from being bundled on client side
declare class ObjectId {
  constructor(id?: string | number);
  toString(): string;
  toHexString(): string;
  static isValid(id: unknown): boolean;
}

type MongoObjectId = ObjectId;

export interface User {
  _id: MongoObjectId
  email: string
  password: string
  role: 'admin' | 'user' | 'therapist'
  emailVerified: boolean
  fullName?: string
  avatarUrl?: string
  lastLogin?: Date
  preferences?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  _id: MongoObjectId
  userId: MongoObjectId
  sessionId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}