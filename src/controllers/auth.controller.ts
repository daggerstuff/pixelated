import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationSchema } from '../validation/register-schema';
import { AuthService } from '../services/auth.service';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async register(req: Request, res: Response): Promise<Response> {
    // Validate request body against RegisterSchema
    const dto = plainToInstance(RegisterDto, req.body);
    const errors = await validate(dto);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    try {
      const user = await this.authService.register(dto);
      const token = await this.authService.generateToken(user);
      return res.status(201).json({ token });
    } catch (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}