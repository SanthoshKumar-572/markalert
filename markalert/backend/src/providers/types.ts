export interface SendNotificationOptions {
  recipient: string;        // 10 digits or E.164 formatted phone number
  messageText: string;
  metadata?: Record<string, any>;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  errorMessage?: string;
  rawResponse?: any;
}

export interface NotificationProvider {
  sendMessage(options: SendNotificationOptions): Promise<SendResult>;
}
