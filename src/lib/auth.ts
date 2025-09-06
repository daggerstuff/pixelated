// Minimal placeholder for requirePageAuth
export async function requirePageAuth(context: { request: Request }, role: string): Promise<Response | null> {
  // Simulate always passing auth for now
  return null;
}
