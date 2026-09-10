// Google Sheets Feedback Integration Service

const GOOGLE_SHEET_URL_KEY = 'pk_google_sheet_webhook_url_v2';
export const DEFAULT_GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbxlFDug61sLPfECYq9kAzyxRQHzPG2ecEA-jZaxJ-h9-hJBYWtGzncF7WFaviKMjA0Vdg/exec';

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

export async function sendFeedbackToGoogleSheet(data: GoogleSheetFeedbackData): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: true };
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const payload = {
    record_id: data.record_id?.trim() || '',
    timestamp,
    customer_name: data.customer_name?.trim() || 'Anonymous Customer',
    overall_rating: data.overall_rating,
    food_rating: data.food_rating || 0,
    service_rating: data.service_rating || 0,
    cleanliness_rating: data.cleanliness_rating || 0,
    message: data.message?.trim() || '',
  };

  try {
    // Send with text/plain body to avoid CORS pre-flight, and follow redirects
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return { success: true };
  } catch (err) {
    console.warn('Google Sheets POST attempt note:', err);

    // Fallback attempt: GET request with query params
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
      await fetch(`${webhookUrl}?${q.toString()}`, {
        method: 'GET',
        mode: 'no-cors',
        redirect: 'follow',
      });
      return { success: true };
    } catch (fallbackErr) {
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return { success: false, error: message };
    }
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
    synced += 1;
  }

  return { success: true, synced };
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
