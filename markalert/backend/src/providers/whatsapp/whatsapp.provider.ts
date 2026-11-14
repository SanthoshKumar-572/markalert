import axios from 'axios';
import { config } from '../../config';
import { NotificationProvider, SendNotificationOptions, SendResult } from '../types';

export class WhatsAppProvider implements NotificationProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private isMock: boolean;

  constructor(customConfig?: { accessToken?: string; phoneNumberId?: string; isMock?: boolean }) {
    this.accessToken = customConfig?.accessToken ?? config.whatsapp.accessToken;
    this.phoneNumberId = customConfig?.phoneNumberId ?? config.whatsapp.phoneNumberId;
    this.isMock = customConfig?.isMock ?? config.isMockMode;
  }

  public async sendMessage(options: SendNotificationOptions): Promise<SendResult> {
    const { recipient, messageText } = options;

    // Normalize phone number: Indian numbers should be formatted as 91XXXXXXXXXX (without +)
    let cleanNumber = recipient.replace(/\D/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }

    if (this.isMock) {
      const mockWamid = `wamid.HBgL${Date.now()}Z${Math.random().toString(36).substring(2, 10).toUpperCase()}A`;
      console.log(`[WHATSAPP MOCK] Sent to: +${cleanNumber} | Msg: "${messageText.replace(/\n/g, ' ')}" | ID: ${mockWamid}`);

      return {
        success: true,
        providerMessageId: mockWamid,
        status: 'SENT',
        rawResponse: {
          mock: true,
          recipient: cleanNumber,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (!this.accessToken || !this.phoneNumberId) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: 'WhatsApp Cloud API credentials not configured (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing)',
      };
    }

    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { preview_url: false, body: messageText },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      });

      const messageId = response.data?.messages?.[0]?.id;
      return {
        success: true,
        providerMessageId: messageId,
        status: 'SENT',
        rawResponse: response.data,
      };
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'WhatsApp Cloud API request failed';
      console.error('[WhatsApp Provider Error]:', errMsg);

      return {
        success: false,
        status: 'FAILED',
        errorMessage: errMsg,
        rawResponse: err.response?.data,
      };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
