export interface PhoneValidationResult {
  isValid: boolean;
  sanitized: string;       // 10 digits without prefix (e.g. 9876543210)
  formattedE164: string;   // +919876543210
  masked: string;          // ******3210
  error?: string;
}

export function validateIndianPhone(raw: any): PhoneValidationResult {
  if (raw === undefined || raw === null || raw === '') {
    return {
      isValid: false,
      sanitized: '',
      formattedE164: '',
      masked: '******',
      error: 'Mobile number is required',
    };
  }

  // Strip all non-digit characters
  let cleaned = String(raw).replace(/\D/g, '');

  // Strip leading 0 (11 digits: e.g. 09876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // Strip leading 91 (12 digits: e.g. 919876543210)
    cleaned = cleaned.substring(2);
  }

  if (cleaned.length !== 10) {
    return {
      isValid: false,
      sanitized: cleaned,
      formattedE164: cleaned ? `+91${cleaned}` : '',
      masked: maskPhone(cleaned),
      error: `Invalid mobile length (${cleaned.length} digits, must be exactly 10 digits)`,
    };
  }

  // Indian mobile numbers must start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(cleaned)) {
    return {
      isValid: false,
      sanitized: cleaned,
      formattedE164: `+91${cleaned}`,
      masked: maskPhone(cleaned),
      error: 'Indian mobile numbers must start with 6, 7, 8, or 9',
    };
  }

  // Check for repetitive identical digits (e.g. 0000000000, 9999999999, 1111111111)
  if (/^(\d)\1{9}$/.test(cleaned)) {
    return {
      isValid: false,
      sanitized: cleaned,
      formattedE164: `+91${cleaned}`,
      masked: maskPhone(cleaned),
      error: 'Mobile number has invalid repetitive identical digits',
    };
  }

  return {
    isValid: true,
    sanitized: cleaned,
    formattedE164: `+91${cleaned}`,
    masked: maskPhone(cleaned),
  };
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '******';
  const lastFour = phone.slice(-4);
  return '******' + lastFour;
}
