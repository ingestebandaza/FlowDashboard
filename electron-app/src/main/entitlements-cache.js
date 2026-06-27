const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { safeStorage } = require('electron');

const CACHE_FILENAME = 'entitlements_cache.bin';
const DEFAULT_OFFLINE_MAX_HOURS = 72;
const DEFAULT_EXPIRATION_GRACE_HOURS = 48;

function cacheFilePath(dataRoot) {
  return path.join(dataRoot, CACHE_FILENAME);
}

function machineFingerprint(installationId) {
  const info = os.userInfo();
  const parts = [
    String(installationId || ''),
    os.hostname() || '',
    os.platform() || '',
    os.arch() || '',
    info && info.username ? info.username : ''
  ];
  return parts.join('|');
}

function deriveKey(installationId) {
  return crypto.createHash('sha256').update(machineFingerprint(installationId)).digest();
}

function canonicalPayload(payload) {
  const ordered = {
    license_id: payload.license_id || null,
    plan: payload.plan || null,
    plan_version: payload.plan_version || null,
    features: Array.isArray(payload.features) ? payload.features.slice().sort() : [],
    limits: payload.limits || null,
    issued_at: payload.issued_at || null,
    valid_until: payload.valid_until || null,
    installation_id: payload.installation_id || null,
    offline_max_hours: typeof payload.offline_max_hours === 'number' ? payload.offline_max_hours : DEFAULT_OFFLINE_MAX_HOURS,
    expiration_grace_hours: typeof payload.expiration_grace_hours === 'number' ? payload.expiration_grace_hours : DEFAULT_EXPIRATION_GRACE_HOURS,
    cached_at: payload.cached_at
  };
  return JSON.stringify(ordered);
}

function signPayload(payload) {
  const key = deriveKey(payload.installation_id);
  return crypto.createHmac('sha256', key).update(canonicalPayload(payload)).digest('hex');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function saveEntitlementsCache(dataRoot, input) {
  const payload = {
    license_id: input.license_id || null,
    plan: input.plan || null,
    plan_version: input.plan_version || null,
    features: Array.isArray(input.features) ? input.features.slice() : [],
    limits: input.limits || null,
    issued_at: input.issued_at || null,
    valid_until: input.valid_until || null,
    installation_id: input.installation_id || null,
    offline_max_hours: typeof input.offline_max_hours === 'number' ? input.offline_max_hours : DEFAULT_OFFLINE_MAX_HOURS,
    expiration_grace_hours: typeof input.expiration_grace_hours === 'number' ? input.expiration_grace_hours : DEFAULT_EXPIRATION_GRACE_HOURS,
    cached_at: new Date().toISOString()
  };
  payload.signature = signPayload(payload);

  const json = JSON.stringify(payload);
  const filePath = cacheFilePath(dataRoot);
  ensureDir(path.dirname(filePath));

  let buffer;
  let encrypted = false;
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    buffer = safeStorage.encryptString(json);
    encrypted = true;
  } else {
    buffer = Buffer.from(json, 'utf8');
  }

  const envelope = Buffer.concat([
    Buffer.from(encrypted ? 'E1' : 'P1', 'utf8'),
    buffer
  ]);

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tempPath, 'w');
  try {
    fs.writeFileSync(fd, envelope);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, filePath);
  return { ok: true, encrypted };
}

function hoursBetween(fromIso, toDate) {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return null;
  return (toDate.getTime() - from) / 3600000;
}

function loadEntitlementsCache(dataRoot) {
  const filePath = cacheFilePath(dataRoot);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: 'not_found' };
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath);
  } catch (e) {
    return { ok: false, reason: 'read_error', error: e.message };
  }

  const tag = raw.slice(0, 2).toString('utf8');
  const body = raw.slice(2);
  let json;
  try {
    if (tag === 'E1') {
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
        return { ok: false, reason: 'encryption_unavailable' };
      }
      json = safeStorage.decryptString(body);
    } else if (tag === 'P1') {
      json = body.toString('utf8');
    } else {
      return { ok: false, reason: 'bad_envelope' };
    }
  } catch (e) {
    return { ok: false, reason: 'decrypt_error', error: e.message };
  }

  let payload;
  try {
    payload = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: 'parse_error', error: e.message };
  }

  const providedSignature = payload.signature;
  const expectedSignature = signPayload(payload);
  if (!providedSignature || providedSignature !== expectedSignature) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  const now = new Date();
  const offlineMax = typeof payload.offline_max_hours === 'number' ? payload.offline_max_hours : DEFAULT_OFFLINE_MAX_HOURS;
  const graceHours = typeof payload.expiration_grace_hours === 'number' ? payload.expiration_grace_hours : DEFAULT_EXPIRATION_GRACE_HOURS;

  const ageHours = hoursBetween(payload.cached_at, now);
  const offlineExpired = ageHours !== null && ageHours > offlineMax;

  let validUntilExpired = false;
  let hoursPastValidUntil = null;
  if (payload.valid_until) {
    const validUntil = new Date(payload.valid_until).getTime();
    if (!Number.isNaN(validUntil) && now.getTime() > validUntil) {
      validUntilExpired = true;
      hoursPastValidUntil = (now.getTime() - validUntil) / 3600000;
    }
  }
  const graceExpired = validUntilExpired && hoursPastValidUntil !== null && hoursPastValidUntil > graceHours;

  return {
    ok: true,
    data: payload,
    age_hours: ageHours,
    offline_max_hours: offlineMax,
    offline_expired: offlineExpired,
    expiration_grace_hours: graceHours,
    valid_until_expired: validUntilExpired,
    hours_past_valid_until: hoursPastValidUntil,
    grace_expired: graceExpired,
    blocked: Boolean(offlineExpired || graceExpired)
  };
}

function clearEntitlementsCache(dataRoot) {
  const filePath = cacheFilePath(dataRoot);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  CACHE_FILENAME,
  saveEntitlementsCache,
  loadEntitlementsCache,
  clearEntitlementsCache
};
