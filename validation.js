export function validateSocialHandle(handle) {
  if (!handle) return { valid: true, error: null };
  if (typeof handle !== 'string') {
    return { valid: false, error: 'Social handle must be text' };
  }
  if (handle.length > 100) {
    return { valid: false, error: 'Social handle too long (max 100 characters)' };
  }
  if (!/^[a-zA-Z0-9_-]*$/.test(handle)) {
    return { valid: false, error: 'Social handle can only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true, error: null };
}

export function validateScore(score) {
  if (typeof score !== 'number' || score < 0 || score > 10000) {
    return { valid: false, error: 'Invalid score' };
  }
  return { valid: true, error: null };
}

export function validateWalletAddress(address) {
  if (!address) return { valid: true, error: null };
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid wallet address' };
  }
  return { valid: true, error: null };
}

export function validateUsername(username) {
  if (!username) return { valid: false, error: 'Username required' };
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be text' };
  }
  if (username.length > 255) {
    return { valid: false, error: 'Username too long' };
  }
  return { valid: true, error: null };
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

export function generateUserId() {
  const stored = localStorage.getItem('gmmc_user_id');
  if (stored) return stored;

  const newId = 'user_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem('gmmc_user_id', newId);
  return newId;
}
