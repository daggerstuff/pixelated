import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

export function createAuthRoutes(router: typeof import('express').Router) {
  const authController = new AuthController();
  router.post('/register', authController.register.bind(authController));
}