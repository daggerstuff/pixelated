import { postgresPool } from '@/config/database'
import { User, UserRole } from '@/types/user'

interface UserRow {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  password_hash: string | null
  role: UserRole
  is_active: boolean
  is_email_verified: boolean
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
}

export class UserModel {
  private static mapRowToUser(row: UserRow): User {
    const user: User = {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isActive: row.is_active,
      isEmailVerified: row.is_email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    if (row.password_hash !== null) {
      user.password = row.password_hash
    }

    if (row.last_login_at !== null) {
      user.lastLoginAt = row.last_login_at
    }

    return user
  }

  static async create(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<User> {
    const sql = `
      INSERT INTO users (
        email, username, first_name, last_name, password_hash,
        role, is_active, is_email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `
    const result = await postgresPool.query<UserRow>(sql, [
      userData.email,
      userData.username,
      userData.firstName,
      userData.lastName,
      userData.password,
      userData.role,
      userData.isActive,
      userData.isEmailVerified,
    ])

    const row = result.rows[0]
    if (!row) {
      throw new Error('Failed to create user record')
    }

    return this.mapRowToUser(row)
  }

  static async findByEmail(email: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE email = $1`
    const result = await postgresPool.query<UserRow>(sql, [email])
    const row = result.rows[0]
    return row ? this.mapRowToUser(row) : null
  }

  static async findById(id: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE id = $1`
    const result = await postgresPool.query<UserRow>(sql, [id])
    const row = result.rows[0]
    return row ? this.mapRowToUser(row) : null
  }

  static async findByUsername(username: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE username = $1`
    const result = await postgresPool.query<UserRow>(sql, [username])
    const row = result.rows[0]
    return row ? this.mapRowToUser(row) : null
  }

  static async update(
    id: string,
    updates: Partial<User>,
  ): Promise<User | null> {
    const setClause: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    const passwordColumn = 'password_hash'
    const mapping: Record<string, string> = {
      email: 'email',
      username: 'username',
      firstName: 'first_name',
      lastName: 'last_name',
      role: 'role',
      isActive: 'is_active',
      isEmailVerified: 'is_email_verified',
      lastLoginAt: 'last_login_at',
    }

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'password') {
        setClause.push(`${passwordColumn} = $${paramIndex++}`)
        values.push(value)
        continue
      }

      if (mapping[key]) {
        setClause.push(`${mapping[key]} = $${paramIndex++}`)
        values.push(value)
      }
    }

    if (setClause.length === 0) return await this.findById(id)

    setClause.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    const sql = `
      UPDATE users 
      SET ${setClause.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await postgresPool.query<UserRow>(sql, values)
    const row = result.rows[0]
    return row ? this.mapRowToUser(row) : null
  }

  static async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM users WHERE id = $1`
    const result = await postgresPool.query(sql, [id])
    return (result.rowCount ?? 0) > 0
  }

  static async findAll(): Promise<User[]> {
    const sql = `SELECT * FROM users ORDER BY created_at DESC`
    const result = await postgresPool.query<UserRow>(sql)
    return result.rows.map((row) => this.mapRowToUser(row))
  }
}
