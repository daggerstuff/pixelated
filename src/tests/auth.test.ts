import request from "supertest";
import { app } from "../app"; // Assuming your Express app is exported from src/app.ts
import { getConnection } from "typeorm";

describe("POST /register", () => {
  beforeAll(async () => {
    // Ensure DB connection
    await getConnection();
  });

  afterAll(async () => {
    await getConnection().close();
  });

  it("should reject a request missing the email field", async () => {
    const response = await request(app)
      .post("/register")
      .send({ password: "secret123" });
    expect(response.status).toBe(400);
    expect(response.body.errors[0]).toMatch(/email/);
  });

  it("should reject a weak password", async () => {
    const response = await request(app)
      .post("/register")
      .send({ email: "test@example.com", password: "123" });
    expect(response.status).toBe(400);
    expect(response.body.errors[0]).toMatch(/minlength/);
  });
});
