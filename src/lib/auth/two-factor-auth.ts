export const setupTwoFactorAuth = async () => ({ secret: 'mock', qrCode: 'mock', backupCodes: ['code1'], setupComplete: false });
export const completeTwoFactorSetup = async () => { };
export const verifyTwoFactorToken = async () => true;
export const isTwoFactorRequired = async () => false;
export interface TwoFactorVerification { userId: string; token: string; deviceId: string; deviceName?: string; trustDevice?: boolean; }
