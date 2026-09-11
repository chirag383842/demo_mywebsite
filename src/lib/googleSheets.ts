// Google Sheets Feedback Integration Service

const GOOGLE_SHEET_URL_KEY = 'pk_google_sheet_webhook_url_v2';
export const DEFAULT_GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwLc-t7sDn6b_cJ_ig5j6OLsK9nqtWfZZH-oWOU9O4l1wc3pRau1fu3KFF4-WPcB3ff0Q/exec';

export function getGoogleSheetUrl(): string {
  // 1. Highest priority: User customized webhook URL in Admin portal
  try {
    const saved = localStorage.getItem(GOOGLE_SHEET_URL_KEY);
    if (saved && saved.trim() && saved.startsWith('https://script.google.com')) {
      return saved.trim();
    }
  } catch {
    // Ignore
  }

  // 2. Env variable provided in .env
  const envUrl = (import.meta.env.VITE_GOOGLE_SHEETS_URL || '').trim();
  if (envUrl && envUrl.startsWith('https://script.google.com') && !envUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return envUrl;
  }

  return DEFAULT_GOOGLE_SHEET_URL;
}

export function setGoogleSheetUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(GOOGLE_SHEET_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(GOOGLE_SHEET_URL_KEY);
    }
  } catch {
    // Ignore
  }
}

export type GoogleSheetFeedbackData = {
  record_id?: string;
  customer_name?: string;
  overall_rating: number;
  food_rating?: number;
  service_rating?: number;
  cleanliness_rating?: number;
  message?: string;
  submitted_at?: string;
};

export const STORAGE_SYNCED_SHEET_IDS = 'pk_sheet_synced_ids_v1';

export function getSyncedSheetIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_SYNCED_SHEET_IDS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markSheetIdSynced(id: string): void {
  if (!id) return;
  try {
    const set = getSyncedSheetIds();
    set.add(id);
    localStorage.setItem(STORAGE_SYNCED_SHEET_IDS, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

const inFlightOrSynced = new Set<string>();
const recentFingerprints = new Map<string, number>();

export async function sendFeedbackToGoogleSheet(data: GoogleSheetFeedbackData): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: true };
  }

  const recordId = data.record_id?.trim() || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Prevent duplicate concurrent / repeated submissions for the same record ID
  if (inFlightOrSynced.has(recordId)) {
    return { success: true };
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const payload = {
    record_id: recordId,
    timestamp: data.submitted_at ? new Date(data.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : timestamp,
    customer_name: data.customer_name?.trim() || 'Anonymous Customer',
    overall_rating: data.overall_rating,
    food_rating: data.food_rating || 0,
    service_rating: data.service_rating || 0,
    cleanliness_rating: data.cleanliness_rating || 0,
    message: data.message?.trim() || '',
  };

  // Content fingerprint deduplication: prevent the exact same feedback from being posted multiple times
  const fingerprint = [
    payload.customer_name.toLowerCase(),
    payload.overall_rating,
    payload.food_rating,
    payload.service_rating,
    payload.cleanliness_rating,
    payload.message.toLowerCase(),
  ].join(':::');

  const now = Date.now();
  const lastTime = recentFingerprints.get(fingerprint);
  if (lastTime && now - lastTime < 60_000) {
    // Exactly identical review was already sent to Google Sheets within the last 60 seconds
    return { success: true };
  }

  inFlightOrSynced.add(recordId);
  recentFingerprints.set(fingerprint, now);

  try {
    const q = new URLSearchParams({
      record_id: payload.record_id,
      timestamp: payload.timestamp,
      customer_name: payload.customer_name,
      overall_rating: String(payload.overall_rating),
      food_rating: String(payload.food_rating),
      service_rating: String(payload.service_rating),
      cleanliness_rating: String(payload.cleanliness_rating),
      message: payload.message,
    });
    const targetUrl = `${webhookUrl}?${q.toString()}`;

    // Single reliable delivery: fetch with keepalive: true.
    // We strictly do NOT fire a parallel Image beacon to avoid creating duplicate entries in the Google Sheet.
    try {
      await fetch(targetUrl, {
        method: 'GET',
        mode: 'no-cors',
        redirect: 'follow',
        keepalive: true,
        cache: 'no-cache',
      });
    } catch {
      // Fallback only if fetch fails in the browser
      if (typeof Image !== 'undefined') {
        const beacon = new Image();
        beacon.src = targetUrl;
      }
    }

    markSheetIdSynced(payload.record_id);
    return { success: true };
  } catch (err) {
    inFlightOrSynced.delete(recordId);
    console.warn('Google Sheets delivery error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function syncFeedbackToGoogleSheet(
  records: GoogleSheetFeedbackData[]
): Promise<{ success: boolean; synced: number; error?: string }> {
  let synced = 0;

  for (const record of records) {
    const result = await sendFeedbackToGoogleSheet(record);
    if (!result.success) {
      return { success: false, synced, error: result.error || 'A review could not be synced.' };
    }
    if (record.record_id) {
      markSheetIdSynced(record.record_id);
    }
    synced += 1;
  }

  return { success: true, synced };
}

/**
 * Automatically sync any reviews that have not yet been recorded in the Google Sheet.
 * Safe to run periodically and on real-time feedback arrival.
 */
export async function autoSyncUnsyncedReviews(
  records: GoogleSheetFeedbackData[]
): Promise<{ success: boolean; syncedCount: number }> {
  const syncedIds = getSyncedSheetIds();
  const unsynced = records.filter((r) => r.record_id && !syncedIds.has(r.record_id));
  if (unsynced.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let count = 0;
  for (const record of unsynced) {
    const result = await sendFeedbackToGoogleSheet(record);
    if (result.success) {
      count++;
    }
  }

  return { success: true, syncedCount: count };
}

/**
 * Diagnostic helper to test the webhook endpoint from the Admin panel
 */
export async function testGoogleSheetWebhook(targetUrl?: string): Promise<{ success: boolean; message: string }> {
  const url = (targetUrl || getGoogleSheetUrl()).trim();
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: false, message: 'Google Sheets webhook URL is not configured or contains placeholder.' };
  }

  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let jsonStatus = '';
    try {
      const parsed = JSON.parse(text);
      if (parsed.status === 'success' || parsed.message) {
        jsonStatus = parsed.message;
      }
    } catch {
      // not json, use text
    }

    return {
      success: true,
      message: jsonStatus || (text.length > 80 ? text.slice(0, 80) + '...' : text) || 'Connected successfully to Google Apps Script webhook!',
    };
  } catch {
    // If CORS blocked reading the response directly, test with no-cors probe
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', redirect: 'follow' });
      return {
        success: true,
        message: 'Connected to Webhook (endpoint reachable via browser proxy)',
      };
    } catch (err2) {
      return {
        success: false,
        message: err2 instanceof Error ? err2.message : 'Unable to connect to Google Apps Script URL',
      };
    }
  }
}
