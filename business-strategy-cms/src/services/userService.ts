import bcrypt from 'bcryptjs'
import { User, UserRole } from '@/types/user'
import { UserModel } from '@/models/User'
import { EmailService } from './emailService'

export class UserService {
  static async getAllUsers(): Promise<User[]> {
    return UserModel.findAll()
  }

  static async getUserById(id: string): Promise<User | null> {
    return UserModel.findById(id)
  }

  static async updateUserRole(
    id: string,
    role: UserRole,
  ): Promise<User | null> {
    return UserModel.update(id, { role })
  }

  static async deactivateUser(id: string): Promise<User | null> {
    return UserModel.update(id, { isActive: false })
  }

  static async activateUser(id: string): Promise<User | null> {
    return UserModel.update(id, { isActive: true })
  }

  static async inviteUser(
    email: string,
    role: UserRole,
  ): Promise<{ user: User; temporaryPassword: string }> {
    const temporaryPassword = Math.random().toString(36).substring(2, 15)
    const username = email.split('@')[0]

    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12')
    const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds)

    const user = await UserModel.create({
      email,
      username,
      firstName: '',
      lastName: '',
      password: hashedPassword,
      role,
      isActive: true,
      isEmailVerified: false,
    })

    await EmailService.sendInvitationEmail(email, temporaryPassword, role)
    return { user, temporaryPassword }
  }

  static async completeOnboarding(
    userId: string,
    firstName: string,
    lastName: string,
    newPassword: string,
  ): Promise<User | null> {
    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12')
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    const user = await UserModel.update(userId, {
      firstName,
      lastName,
      password: hashedPassword,
      isEmailVerified: true,
    })

    if (user) {
      await EmailService.sendWelcomeEmail(user.email, user.username)
    }

    return user
  }
}

