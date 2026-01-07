import { User, UserRole } from '@/types/user'
import { postgresPool } from '@/config/database'

export class UserModel {
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      password: row.password_hash,
      role: row.role as UserRole,
      isActive: row.is_active,
      isEmailVerified: row.is_email_verified,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
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
    const result = await postgresPool.query(sql, [
      userData.email,
      userData.username,
      userData.firstName,
      userData.lastName,
      userData.password,
      userData.role,
      userData.isActive,
      userData.isEmailVerified,
    ])

    return this.mapRowToUser(result.rows[0])
  }

  static async findByEmail(email: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE email = $1`
    const result = await postgresPool.query(sql, [email])
    return result.rows.length ? this.mapRowToUser(result.rows[0]) : null
  }

  static async findById(id: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE id = $1`
    const result = await postgresPool.query(sql, [id])
    return result.rows.length ? this.mapRowToUser(result.rows[0]) : null
  }

  static async findByUsername(username: string): Promise<User | null> {
    const sql = `SELECT * FROM users WHERE username = $1`
    const result = await postgresPool.query(sql, [username])
    return result.rows.length ? this.mapRowToUser(result.rows[0]) : null
  }

  static async update(
    id: string,
    updates: Partial<User>,
  ): Promise<User | null> {
    const setClause: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const mapping: Record<string, string> = {
      email: 'email',
      username: 'username',
      firstName: 'first_name',
      lastName: 'last_name',
      password: 'password_hash',
      role: 'role',
      isActive: 'is_active',
      isEmailVerified: 'is_email_verified',
      lastLoginAt: 'last_login_at',
    }

    for (const [key, value] of Object.entries(updates)) {
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

    const result = await postgresPool.query(sql, values)
    return result.rows.length ? this.mapRowToUser(result.rows[0]) : null
  }

  static async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM users WHERE id = $1`
    const result = await postgresPool.query(sql, [id])
    return (result.rowCount ?? 0) > 0
  }

  static async findAll(): Promise<User[]> {
    const sql = `SELECT * FROM users ORDER BY created_at DESC`
    const result = await postgresPool.query(sql)
    return result.rows.map((row) => this.mapRowToUser(row))
  }
}
