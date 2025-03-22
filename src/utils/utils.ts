import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an Ethereum address for display by shortening it
 * @param address Full Ethereum address
 * @returns Shortened address in format 0x1234...5678
 */
export function getAddressDisplay(address: string): string {
  if (!address) return '';
  if (address.length < 10) return address;
  
  const start = address.substring(0, 6);
  const end = address.substring(address.length - 4);
  
  return `${start}...${end}`;
}
