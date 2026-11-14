import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

export interface FacultyWhatsAppSession {
  userId: string;
  status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';
  phoneNumber?: string;
  pushName?: string;
  qrCodeDataUrl?: string;
  socket?: WASocket;
  lastConnectedAt?: string;
  lastError?: string;
  isSimulated?: boolean;
}

class BaileysWhatsAppManager {
  private sessions: Map<string, FacultyWhatsAppSession> = new Map();
  private baseStorageDir: string;
  private logger = pino({ level: 'silent' });

  constructor() {
    this.baseStorageDir = path.resolve(process.cwd(), 'data', 'whatsapp_sessions');
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  // Get session status for a specific faculty member
  public getSession(userId: string): FacultyWhatsAppSession {
    let session = this.sessions.get(userId);
    if (!session) {
      // Check if saved simulated session exists in directory
      const simFilePath = path.join(this.baseStorageDir, `${userId}_simulated.json`);
      if (fs.existsSync(simFilePath)) {
        try {
          const simData = JSON.parse(fs.readFileSync(simFilePath, 'utf8'));
          session = {
            userId,
            status: 'CONNECTED',
            phoneNumber: simData.phoneNumber,
            pushName: simData.pushName,
            lastConnectedAt: simData.lastConnectedAt,
            isSimulated: true
          };
          this.sessions.set(userId, session);
          return session;
        } catch (e) {}
      }

      session = {
        userId,
        status: 'DISCONNECTED'
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  // Format phone number to WhatsApp JID format
  private formatJid(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      clean = '91' + clean; // Default India prefix
    }
    return `${clean}@s.whatsapp.net`;
  }

  // Initiate QR generation and Baileys connection for a faculty member
  public async initializeSession(userId: string): Promise<FacultyWhatsAppSession> {
    const existing = this.sessions.get(userId);
    if (existing?.status === 'CONNECTED' && existing.socket) {
      return existing;
    }

    const sessionDir = path.join(this.baseStorageDir, userId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const session: FacultyWhatsAppSession = {
      userId,
      status: 'CONNECTING',
      isSimulated: false
    };
    this.sessions.set(userId, session);

    try {
      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: this.logger,
        browser: ['College Internal Marks System', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false
      });

      session.socket = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
              color: {
                dark: '#0f172a',
                light: '#ffffff'
              }
            });
            session.qrCodeDataUrl = qrDataUrl;
            session.status = 'SCAN_QR';
            session.lastError = undefined;
          } catch (err: any) {
            console.error('[Baileys QR Generation Error]:', err);
          }
        }

        if (connection === 'connecting') {
          session.status = session.qrCodeDataUrl ? 'SCAN_QR' : 'CONNECTING';
        } else if (connection === 'open') {
          const userJid = sock.user?.id || '';
          const rawNum = userJid.split(':')[0] || userJid.split('@')[0];
          session.status = 'CONNECTED';
          session.phoneNumber = rawNum ? `+${rawNum}` : '+91 98765 43210';
          session.pushName = sock.user?.name || 'Faculty WhatsApp';
          session.qrCodeDataUrl = undefined;
          session.lastConnectedAt = new Date().toISOString();
          console.log(`[Baileys] Faculty ${userId} WhatsApp connected successfully! Number: ${session.phoneNumber}`);
        } else if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[Baileys] Faculty ${userId} connection closed with status ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            session.status = 'DISCONNECTED';
            session.socket = undefined;
            session.qrCodeDataUrl = undefined;
            // Clean auth credentials
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (e) {}
          } else if (shouldReconnect) {
            session.status = 'CONNECTING';
            setTimeout(() => {
              this.initializeSession(userId).catch(console.error);
            }, 5000);
          } else {
            session.status = 'DISCONNECTED';
            session.socket = undefined;
          }
        }
      });

      return session;
    } catch (err: any) {
      console.error(`[Baileys Init Error for ${userId}]:`, err);
      session.status = 'DISCONNECTED';
      session.lastError = err.message;
      return session;
    }
  }

  // Simulate Instant Connection for testing & presentation without second phone
  public async simulateConnect(userId: string, facultyName: string, facultyPhone: string): Promise<FacultyWhatsAppSession> {
    // Clean actual socket if any
    const existing = this.sessions.get(userId);
    if (existing?.socket) {
      try { existing.socket.end(undefined); } catch (e) {}
    }

    const cleanNum = facultyPhone.startsWith('+') ? facultyPhone : `+91 ${facultyPhone}`;
    const simData = {
      userId,
      phoneNumber: cleanNum,
      pushName: facultyName || 'Faculty Personal WhatsApp',
      lastConnectedAt: new Date().toISOString(),
      isSimulated: true
    };

    const simFilePath = path.join(this.baseStorageDir, `${userId}_simulated.json`);
    fs.writeFileSync(simFilePath, JSON.stringify(simData, null, 2));

    const session: FacultyWhatsAppSession = {
      userId,
      status: 'CONNECTED',
      phoneNumber: cleanNum,
      pushName: facultyName,
      lastConnectedAt: simData.lastConnectedAt,
      isSimulated: true
    };

    this.sessions.set(userId, session);
    console.log(`[Baileys Simulated] Faculty ${userId} linked with phone ${cleanNum}`);
    return session;
  }

  // Disconnect and remove session
  public async disconnectSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session?.socket) {
      try {
        await session.socket.logout();
        session.socket.end(undefined);
      } catch (e) {}
    }

    // Remove storage directories & simulation files
    const sessionDir = path.join(this.baseStorageDir, userId);
    if (fs.existsSync(sessionDir)) {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    }
    const simFilePath = path.join(this.baseStorageDir, `${userId}_simulated.json`);
    if (fs.existsSync(simFilePath)) {
      try { fs.unlinkSync(simFilePath); } catch (e) {}
    }

    this.sessions.set(userId, {
      userId,
      status: 'DISCONNECTED'
    });
  }

  // Send WhatsApp message through this faculty member's personal session
  public async sendMessage(
    userId: string,
    toPhone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; senderPhone?: string }> {
    const session = this.getSession(userId);

    if (session.status !== 'CONNECTED') {
      return {
        success: false,
        error: `Faculty WhatsApp is not connected (status: ${session.status}). Please link your WhatsApp device via QR code first.`
      };
    }

    // If simulated session
    if (session.isSimulated || !session.socket) {
      const mockId = `BAILEYS_SIM_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      console.log(`[Baileys Simulated Send] From: ${session.phoneNumber} (${session.pushName}) -> To: ${toPhone}`);
      console.log(`[Baileys Message Content]:\n${message}\n`);
      return {
        success: true,
        messageId: mockId,
        senderPhone: session.phoneNumber
      };
    }

    // Real Baileys socket send
    try {
      const jid = this.formatJid(toPhone);
      const sentMsg = await session.socket.sendMessage(jid, { text: message });
      const msgId = sentMsg?.key?.id || `BAILEYS_${Date.now()}`;
      console.log(`[Baileys Real Send] From: ${session.phoneNumber} -> To: ${jid} (ID: ${msgId})`);
      return {
        success: true,
        messageId: msgId,
        senderPhone: session.phoneNumber
      };
    } catch (err: any) {
      console.error(`[Baileys Send Error for ${userId}]:`, err);
      return {
        success: false,
        error: err.message || 'Failed to send WhatsApp message through linked phone.'
      };
    }
  }
}

export const baileysWhatsAppManager = new BaileysWhatsAppManager();
