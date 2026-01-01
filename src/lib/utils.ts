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
  // Show dates in "DD MMM YYYY" format to match Google Sheets
  // NO TIMEZONE CONVERSION - treat as date-only string
  if (typeof date === "string") {
    // If already in "DD MMM YYYY" format, return as-is
    if (date.match(/^\d{1,2}\s+\w{3}\s+\d{4}$/)) {
      return date;
    }
    // If it's an ISO date string (YYYY-MM-DD), convert to "DD MMM YYYY"
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-').map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
      }
    }
    // For other formats, return as-is
    return date;
  } else {
    // If it's a Date object, extract components directly
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

/**
 * Format date as DD MMM YYYY (e.g., "15 Jan 2024") for Google Sheets
 * This is the format expected by Google Sheets when inserting dates
 */
export function formatDateForSheets(date: string | Date): string {
  // NO TIMEZONE CONVERSION - treat as date-only string
  if (typeof date === "string") {
    // If it's an ISO date string (YYYY-MM-DD), extract components directly
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-').map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
      }
    }
    // For other formats, return as-is or try to parse
    return date;
  } else {
    // If it's a Date object, extract components directly
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

/**
 * Convert ISO date (YYYY-MM-DD) to DD/MM/YYYY format
 */
export function isoToDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '';
  // NO TIMEZONE CONVERSION - extract components directly from ISO string
  if (isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = isoDate.split('-').map(Number);
    // Validate date components
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }
  return isoDate; // Return as-is if not valid ISO format
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

