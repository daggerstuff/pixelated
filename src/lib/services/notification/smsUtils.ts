// Minimal placeholder for smsUtils
export function sendSMS(to, message) {
  // TODO: Implement SMS sending logic
  return true;
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Basic phone number validation - can be enhanced
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phoneNumber);
}
