import axios from 'axios';

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  errorMessage?: string;
  rawResponse?: any;
}

export class WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private isMock: boolean;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.isMock = (process.env.MOCK_NOTIFICATION_PROVIDER || 'true').toLowerCase() === 'true';
  }

  public async sendMessage(to: string, messageText: string): Promise<WhatsAppSendResult> {
    // Sanitize phone number (Indian format: prepend 91 if 10-digit)
    let cleanNumber = to.replace(/\D/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }

    if (this.isMock) {
      // Realistic simulation for development/testing
      const mockWamid = `wamid.HBgL${Date.now()}Z${Math.random().toString(36).substring(2, 10).toUpperCase()}A`;
      console.log(`[WHATSAPP MOCK] To: ${cleanNumber} | Body: ${messageText.replace(/\n/g, ' ')}`);

      return {
        success: true,
        providerMessageId: mockWamid,
        status: 'SENT',
        rawResponse: { mock: true, recipient: cleanNumber, timestamp: new Date().toISOString() }
      };
    }

    // Real Meta WhatsApp Cloud API
    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { preview_url: false, body: messageText }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const messageId = response.data?.messages?.[0]?.id;
      return {
        success: true,
        providerMessageId: messageId,
        status: 'SENT',
        rawResponse: response.data
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Unknown WhatsApp API error';
      console.error('[WhatsApp Provider Error]:', errMsg);
      return {
        success: false,
        status: 'FAILED',
        errorMessage: errMsg,
        rawResponse: err.response?.data
      };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
