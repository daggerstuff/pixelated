import { User, } from '@/types/user'

// In-memory user storage for now - will be replaced with database
const users: User[] = []
let nextId = 1

export class UserModel {
  static async create(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<User> {
    const user: User = {
      ...userData,
      id: (nextId++).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    users.push(user)
    return user
  }

  static async findByEmail(email: string): Promise<User | null> {
    return users.find((user) => user.email === email) || null
  }

  static async findById(id: string): Promise<User | null> {
    return users.find((user) => user.id === id) || null
  }

  static async findByUsername(username: string): Promise<User | null> {
    return users.find((user) => user.username === username) || null
  }

  static async update(
    id: string,
    updates: Partial<User>,
  ): Promise<User | null> {
    const userIndex = users.findIndex((user) => user.id === id)
    if (userIndex === -1) return null

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date(),
    }
    return users[userIndex]
  }

  static async delete(id: string): Promise<boolean> {
    const userIndex = users.findIndex((user) => user.id === id)
    if (userIndex === -1) return false

    users.splice(userIndex, 1)
    return true
  }

  static async findAll(): Promise<User[]> {
    return [...users]
  }
}
