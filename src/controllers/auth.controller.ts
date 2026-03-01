import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { Request, Response } from 'express'

import { AuthService } from '../services/auth.service'
import { RegisterDto } from '../validation/register-schema'

export class AuthController {
  private authService: AuthService

  constructor(authService: AuthService) {
    this.authService = authService
  }

  async register(req: Request, res: Response): Promise<Response> {
    // Validate request body against RegisterSchema
    const dto = plainToInstance(RegisterDto, req.body)
    const errors = await validate(dto)
    if (errors.length) {
      return res.status(400).json({ errors })
    }

    try {
      const user = await this.authService.register(dto)
      const token = await this.authService.generateToken(user)
      return res.status(201).json({ token })
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}
