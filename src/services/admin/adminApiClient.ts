/**
 * Admin API Client
 * Secure REST client for querying server statistics and inspecting game rooms.
 * Uses Bearer authentication against /api/admin/* endpoints.
 */

import { AdminStatsDTO, AdminRoomSummaryDTO, AdminRoomDebugDTO } from '../../types/admin';

export const ADMIN_KEY_STORAGE = 'cb_admin_api_key';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function getStoredAdminApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (
      sessionStorage.getItem(ADMIN_KEY_STORAGE) ||
      localStorage.getItem(ADMIN_KEY_STORAGE) ||
      ''
    );
  } catch {
    return '';
  }
}

export function setStoredAdminApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const clean = key.trim();
  try {
    if (clean) {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, clean);
      localStorage.setItem(ADMIN_KEY_STORAGE, clean);
    } else {
      clearStoredAdminApiKey();
    }
  } catch {}
}

export function clearStoredAdminApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    localStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {}
}

async function requestAdminApi<T>(path: string, overrideKey?: string): Promise<T> {
  const token = (overrideKey !== undefined ? overrideKey : getStoredAdminApiKey()).trim();

  if (!token) {
    throw new AdminApiError('Admin API key is missing. Please enter your Bearer token.', 401, 'UNAUTHORIZED');
  }

  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;

    try {
      const data = await response.json();
      if (data.code) errorCode = data.code;
      if (data.error) errorMessage = data.error;
    } catch {
      // Fallback if not JSON
    }

    if (response.status === 503) {
      errorMessage =
        'Admin API is not configured on this server. The server must be started with the ADMIN_API_KEY environment variable set.';
    } else if (response.status === 401) {
      errorMessage = 'Missing or malformed Authorization Bearer token.';
    } else if (response.status === 403) {
      errorMessage = 'Invalid admin API key. Access forbidden.';
    } else if (response.status === 404) {
      errorMessage = `Resource not found at ${path}`;
    }

    throw new AdminApiError(errorMessage, response.status, errorCode);
  }

  return response.json() as Promise<T>;
}

export async function fetchAdminStats(overrideKey?: string): Promise<AdminStatsDTO> {
  return requestAdminApi<AdminStatsDTO>('/api/admin/stats', overrideKey);
}

export async function fetchAdminRooms(overrideKey?: string): Promise<AdminRoomSummaryDTO[]> {
  return requestAdminApi<AdminRoomSummaryDTO[]>('/api/admin/rooms', overrideKey);
}

export async function fetchAdminRoomDebug(
  roomCode: string,
  overrideKey?: string
): Promise<AdminRoomDebugDTO> {
  const cleanCode = encodeURIComponent(roomCode.trim().toUpperCase());
  return requestAdminApi<AdminRoomDebugDTO>(`/api/admin/rooms/${cleanCode}`, overrideKey);
}

export async function verifyAdminApiKey(candidateKey: string): Promise<boolean> {
  try {
    await fetchAdminStats(candidateKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format uptime seconds into human-readable string (e.g., "1d 4h 12m 30s")
 */
export function formatUptime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Format bytes into MB/GB with 2 decimals
 */
export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

/**
 * Returns symbol and styling for standard card suits
 */
export function getSuitDisplay(suit: string): { symbol: string; color: string; name: string } {
  const s = suit.toUpperCase();
  switch (s) {
    case 'SPADES':
    case 'SPADE':
    case 'S':
      return { symbol: '♠', color: 'text-stone-300', name: 'Spades' };
    case 'HEARTS':
    case 'HEART':
    case 'H':
      return { symbol: '♥', color: 'text-rose-500', name: 'Hearts' };
    case 'DIAMONDS':
    case 'DIAMOND':
    case 'D':
      return { symbol: '♦', color: 'text-rose-500', name: 'Diamonds' };
    case 'CLUBS':
    case 'CLUB':
    case 'C':
      return { symbol: '♣', color: 'text-emerald-400', name: 'Clubs' };
    default:
      return { symbol: suit, color: 'text-stone-300', name: suit };
  }
}
