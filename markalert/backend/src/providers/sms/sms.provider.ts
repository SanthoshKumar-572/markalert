import axios from 'axios';
import { config } from '../../config';
import { NotificationProvider, SendNotificationOptions, SendResult } from '../types';

export class SMSProvider implements NotificationProvider {
  private apiKey: string;
  private senderId: string;
  private dltTemplateId: string;
  private isMock: boolean;

  constructor(customConfig?: {
    apiKey?: string;
    senderId?: string;
    dltTemplateId?: string;
    isMock?: boolean;
  }) {
    this.apiKey = customConfig?.apiKey ?? config.sms.apiKey;
    this.senderId = customConfig?.senderId ?? config.sms.senderId;
    this.dltTemplateId = customConfig?.dltTemplateId ?? config.sms.dltTemplateId;
    this.isMock = customConfig?.isMock ?? config.isMockMode;
  }

  public async sendMessage(options: SendNotificationOptions): Promise<SendResult> {
    const { recipient, messageText } = options;

    // Normalize phone number: 10-digit clean Indian mobile number
    let cleanNumber = recipient.replace(/\D/g, '');
    if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
      cleanNumber = cleanNumber.substring(2);
    } else if (cleanNumber.length === 11 && cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }

    if (this.isMock) {
      const mockId = `SMS-MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      console.log(`[SMS MOCK] Sent to: +91${cleanNumber} | Sender: ${this.senderId} | Msg: "${messageText}" | ID: ${mockId}`);

      return {
        success: true,
        providerMessageId: mockId,
        status: 'SENT',
        rawResponse: {
          mock: true,
          recipient: cleanNumber,
          senderId: this.senderId,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (!this.apiKey) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: 'SMS Gateway credentials not configured (SMS_API_KEY missing)',
      };
    }

    // Real Indian SMS Gateway (e.g., Fast2SMS DLT-compliant / Quick SMS)
    try {
      const payload: any = {
        flash: 0,
        numbers: cleanNumber,
      };

      if (this.dltTemplateId) {
        payload.route = 'dlt';
        payload.sender_id = this.senderId;
        payload.message = [this.dltTemplateId];
        payload.variables_values = messageText;
      } else {
        payload.route = 'q';
        payload.message = messageText;
      }

      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, {
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      });

      const isSuccess = response.data?.return === true || response.data?.status === 'success';
      const messageId =
        response.data?.request_id ||
        response.data?.message_id ||
        `SMS-${Date.now()}`;

      return {
        success: isSuccess,
        providerMessageId: messageId,
        status: isSuccess ? 'SENT' : 'FAILED',
        errorMessage: isSuccess ? undefined : (response.data?.message || 'SMS Gateway reported failure'),
        rawResponse: response.data,
      };
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'SMS gateway network error';
      console.error('[SMS Provider Error]:', errMsg);

      return {
        success: false,
        status: 'FAILED',
        errorMessage: errMsg,
        rawResponse: err.response?.data,
      };
    }
  }
}

export const smsProvider = new SMSProvider();
