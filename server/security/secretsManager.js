import crypto from 'crypto';

class SecretsManager {
  constructor() {
    this.secrets = {
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_live_recovAI981245',
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'sec_rzp_99xAbCdEfGhIjKlMnOpQrStUvWxYz',
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoverai_live_89123',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyDemoRecoverAIEnterpriseSecretKey',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-proj-recoverai-enterprise-mock-key',
      ZENDESK_WEBHOOK_URL: process.env.ZENDESK_WEBHOOK_URL || 'https://recoverai.zendesk.com/api/v2/tickets',
      WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || 'EAAXDemoTokenForEnterpriseWhatsAppCloudAPI'
    };
  }

  get(key) {
    return this.secrets[key] || process.env[key] || null;
  }

  set(key, value) {
    this.secrets[key] = value;
  }

  maskSecret(val) {
    if (!val || val.length < 8) return '********';
    return `${val.substring(0, 4)}••••••••${val.substring(val.length - 4)}`;
  }

  getAllMasked() {
    const masked = {};
    for (const [k, v] of Object.entries(this.secrets)) {
      masked[k] = this.maskSecret(v);
    }
    return masked;
  }
}

export const secretsManager = new SecretsManager();
