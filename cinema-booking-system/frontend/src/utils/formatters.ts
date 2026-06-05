/**
 * Format a number as Vietnamese Dong (VND).
 * e.g. 150000 → "150.000 ₫"
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a decimal string from the backend into a VND integer.
 * e.g. "150000.00" → 150000
 */
export function parseVND(value: string | number): number {
  if (typeof value === 'number') return Math.round(value);
  return Math.round(parseFloat(value) || 0);
}

/**
 * Format a datetime ISO string to a human-readable showtime string.
 * e.g. "2024-02-15T19:00:00" → "Thứ 5, 15/02/2024 — 19:00"
 */
export function formatShowtime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
