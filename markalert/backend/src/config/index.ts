import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',

  jwt: {
    secret: process.env.JWT_SECRET || 'markalert_jwt_secret_dev_key_super_secure_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'markalert_jwt_refresh_secret_dev_key_2026',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'markalert_whatsapp_webhook_token',
  },

  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || '',
    senderId: process.env.SMS_SENDER_ID || 'MRKALR',
    dltTemplateId: process.env.SMS_DLT_TEMPLATE_ID || '',
  },

  college: {
    name: process.env.COLLEGE_NAME || 'Engineering College',
  },

  isMockMode: (process.env.MOCK_NOTIFICATION_PROVIDER || 'true').toLowerCase() === 'true',

  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.xlsx', '.xls'],
  },
};
