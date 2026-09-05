class SecretsManager {
  constructor() {
    this.secrets = {
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS || '8000',
      AI_DIAGNOSTIC_ENABLED: process.env.AI_DIAGNOSTIC_ENABLED || 'true',
      JWT_SECRET: process.env.JWT_SECRET || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      ZENDESK_WEBHOOK_URL: process.env.ZENDESK_WEBHOOK_URL || '',
      WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || ''
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
      masked[k] = v ? this.maskSecret(v) : '(not configured)';
    }
    return masked;
  }
}

export const secretsManager = new SecretsManager();
