import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export function createAuthRoutes(): Router {
  const router = Router();
  const authController = new AuthController(undefined as any);
  router.post("/register", authController.register.bind(authController));
  return router;
}
