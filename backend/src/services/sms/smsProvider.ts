import axios from 'axios';
import { db } from '../../database/db';

export interface SMSSendResult {
  success: boolean;
  providerMessageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  errorMessage?: string;
  rawResponse?: any;
}

export class SMSProvider {
  private apiKey: string;
  private senderId: string;
  private templateId: string;
  private isMock: boolean;

  constructor() {
    this.apiKey = process.env.SMS_API_KEY || '';
    this.senderId = process.env.SMS_SENDER_ID || 'VSBENG';
    this.templateId = process.env.SMS_TEMPLATE_ID || '';
    this.isMock = (process.env.MOCK_NOTIFICATION_PROVIDER || 'true').toLowerCase() === 'true';
  }

  public async sendMessage(to: string, messageText: string): Promise<SMSSendResult> {
    // Sanitize phone number (strip +91 or non-digits, keep 10-digit number for Indian SMS gateways)
    let cleanNumber = to.replace(/\D/g, '');
    if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
      cleanNumber = cleanNumber.substring(2);
    }

    // Dynamically retrieve configured DLT credentials if updated in settings
    let apiKey = this.apiKey;
    let senderId = this.senderId;
    let templateId = this.templateId;
    let isMock = this.isMock;

    try {
      const apiKeySetting = await db.queryOne<any>('SELECT value FROM system_settings WHERE key = ?', ['SMS_API_KEY']);
      const senderIdSetting = await db.queryOne<any>('SELECT value FROM system_settings WHERE key = ?', ['SMS_SENDER_ID']);
      const templateIdSetting = await db.queryOne<any>('SELECT value FROM system_settings WHERE key = ?', ['SMS_TEMPLATE_ID']);
      const mockSetting = await db.queryOne<any>('SELECT value FROM system_settings WHERE key = ?', ['SMS_MOCK_MODE']);

      if (apiKeySetting?.value) apiKey = apiKeySetting.value;
      if (senderIdSetting?.value) senderId = senderIdSetting.value;
      if (templateIdSetting?.value) templateId = templateIdSetting.value;
      if (mockSetting?.value !== undefined && mockSetting?.value !== null && mockSetting?.value !== '') {
        isMock = String(mockSetting.value).toLowerCase() === 'true';
      }
    } catch (e) {
      // fallback to constructor defaults
    }

    if (isMock) {
      const mockId = `SMS-MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      console.log(`[SMS MOCK] To: ${cleanNumber} | Sender: ${senderId} | Template: ${templateId || 'DLT-TEST'} | Body: ${messageText}`);

      return {
        success: true,
        providerMessageId: mockId,
        status: 'SENT',
        rawResponse: { mock: true, recipient: cleanNumber, senderId, timestamp: new Date().toISOString() }
      };
    }

    // Real Indian SMS Gateway (supports Fast2SMS Quick SMS & DLT gateway)
    try {
      const payload: any = {
        flash: 0,
        numbers: cleanNumber
      };

      if (templateId) {
        payload.route = 'dlt';
        payload.sender_id = senderId;
        payload.message = [templateId];
        payload.variables_values = messageText;
      } else {
        // Quick SMS route (works without DLT registration for instant developer testing)
        payload.route = 'q';
        payload.message = messageText;
      }

      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        payload,
        {
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const isSuccess = response.data?.return === true || response.data?.status === 'success';
      const messageId = response.data?.request_id || response.data?.message_id || `SMS-${Date.now()}`;

      return {
        success: isSuccess,
        providerMessageId: messageId,
        status: isSuccess ? 'SENT' : 'FAILED',
        errorMessage: isSuccess ? undefined : (response.data?.message || 'SMS Gateway reported failure'),
        rawResponse: response.data
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'SMS provider network error';
      console.error('[SMS Provider Error]:', errMsg);
      return {
        success: false,
        status: 'FAILED',
        errorMessage: errMsg,
        rawResponse: err.response?.data
      };
    }
  }
}

export const smsProvider = new SMSProvider();
