import { Router } from "express";

import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import type { UserRepository } from "../services/auth.service";

export function createAuthRoutes(userRepository: UserRepository): Router {
  const router = Router();
  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);
  router.post("/register", authController.register.bind(authController));
  return router;
}
