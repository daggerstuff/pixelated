// Simple email service placeholder
export class EmailService {
  static async sendInvitationEmail(
    email: string,
    temporaryPassword: string,
    role: string,
  ): Promise<void> {
    // Security: Never log credentials. Redact temporary password.

    // In a real implementation, this would use nodemailer or similar
    // to send actual emails
  }

  static async sendWelcomeEmail(
    email: string,
    username: string,
  ): Promise<void> {
    // error handled by caller
  }

  static async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    // error handled by caller
  }

  static async sendEmail(options: {
    to: string
    subject: string
    body: string
  }): Promise<void> {
    // error handled by caller
  }
}
