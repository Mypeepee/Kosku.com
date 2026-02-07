import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number to Indonesian currency (Rupiah)
 * @example formatCurrency(1500000) // "Rp 1.500.000"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (!value) return 'Rp 0';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Format number to short format (Juta, Miliar)
 * @example formatNumber(1500000000) // "1.5 Miliar"
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (!value) return '0';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  if (numValue >= 1_000_000_000_000) {
    return `${(numValue / 1_000_000_000_000).toFixed(1)} Triliun`;
  }
  if (numValue >= 1_000_000_000) {
    return `${(numValue / 1_000_000_000).toFixed(1)} Miliar`;
  }
  if (numValue >= 1_000_000) {
    return `${(numValue / 1_000_000).toFixed(1)} Juta`;
  }
  if (numValue >= 1_000) {
    return `${(numValue / 1_000).toFixed(1)} Ribu`;
  }
  
  return numValue.toLocaleString('id-ID');
}

/**
 * Format number to compact format
 * @example formatCompact(1500000) // "1.5M"
 */
export function formatCompact(value: number | string | null | undefined): string {
  if (!value) return '0';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  if (numValue >= 1_000_000_000) {
    return `${(numValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (numValue >= 1_000_000) {
    return `${(numValue / 1_000_000).toFixed(1)}M`;
  }
  if (numValue >= 1_000) {
    return `${(numValue / 1_000).toFixed(1)}K`;
  }
  
  return numValue.toString();
}

/**
 * Generate SEO-friendly slug from title and city
 * @example generateSlug("Rumah Mewah di Jakarta", "Jakarta Selatan") 
 * // "rumah-mewah-di-jakarta-jakarta-selatan-a1b2c"
 */
export function generateSlug(judul: string, kota?: string): string {
  // Clean title
  const cleanJudul = judul
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .substring(0, 50)          // Limit length
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
  
  // Clean city if provided
  let cleanKota = '';
  if (kota) {
    cleanKota = kota
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .substring(0, 20);
  }
  
  // Generate random ID for uniqueness
  const randomId = Math.random().toString(36).substring(2, 8);
  
  // Combine parts
  const parts = [cleanJudul];
  if (cleanKota) parts.push(cleanKota);
  parts.push(randomId);
  
  return parts.join('-');
}

/**
 * Format date to Indonesian locale
 * @example formatDate(new Date()) // "7 Februari 2026"
 */
export function formatDate(date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  
  return new Intl.DateTimeFormat('id-ID', defaultOptions).format(dateObj);
}

/**
 * Format date to short format
 * @example formatDateShort(new Date()) // "07/02/2026"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hari yang lalu")
 * @example formatRelativeTime(new Date(Date.now() - 86400000)) // "1 hari yang lalu"
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Baru saja';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit yang lalu`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} hari yang lalu`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} bulan yang lalu`;
  
  return `${Math.floor(diffInSeconds / 31536000)} tahun yang lalu`;
}

/**
 * Truncate text with ellipsis
 * @example truncate("Lorem ipsum dolor sit amet", 10) // "Lorem ipsu..."
 */
export function truncate(text: string, maxLength: number = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Capitalize first letter of each word
 * @example capitalize("rumah mewah jakarta") // "Rumah Mewah Jakarta"
 */
export function capitalize(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format phone number to WhatsApp format (62xxx)
 * @example formatPhoneForWhatsApp("0812345678") // "62812345678"
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Replace leading 0 with 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  
  // Add 62 if not present
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format phone number to display format
 * @example formatPhoneDisplay("628123456789") // "+62 812-3456-789"
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('62')) {
    const rest = cleaned.substring(2);
    return `+62 ${rest.substring(0, 3)}-${rest.substring(3, 7)}-${rest.substring(7)}`;
  }
  
  return phone;
}

/**
 * Parse query string to object
 * @example parseQueryString("?page=1&limit=10") // { page: "1", limit: "10" }
 */
export function parseQueryString(search: string): Record<string, string> {
  if (!search) return {};
  
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  
  return false;
}

/**
 * Get file size in human readable format
 * @example getFileSize(1536) // "1.5 KB"
 */
export function getFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sleep/delay function
 * @example await sleep(1000) // Wait 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Get initials from name
 * @example getInitials("John Doe") // "JD"
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate random color for avatar
 */
export function getRandomColor(seed?: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];
  
  if (seed) {
    const hash = seed.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }
  
  return colors[Math.floor(Math.random() * colors.length)];
}
