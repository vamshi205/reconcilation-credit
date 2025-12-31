import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert ISO date (YYYY-MM-DD) to DD/MM/YYYY format
 */
export function isoToDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert DD/MM/YYYY format to ISO date (YYYY-MM-DD)
 */
export function ddmmYYYYToISO(dateStr: string): string {
  if (!dateStr) return '';
  // Remove any non-digit characters except /
  const cleaned = dateStr.replace(/[^\d/]/g, '');
  // Match DD/MM/YYYY or DD/MM/YY
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return '';
  
  let day = parseInt(match[1], 10);
  let month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  
  // Handle 2-digit years
  if (year < 100) {
    year = year < 50 ? 2000 + year : 1900 + year;
  }
  
  // Validate date
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  
  // Create date and validate
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return '';
  }
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function generateId(): string {
  return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

