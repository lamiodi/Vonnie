import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names using clsx and tailwind-merge
 * This ensures Tailwind classes are properly merged and duplicates are removed
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values
 */
export function formatCurrency(amount, currency = 'NGN') {
  if (amount == null || isNaN(amount)) return '₦0.00'
  
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  
  return formatter.format(amount)
}

/**
 * Format numbers with commas
 */
export function formatNumber(number, options = {}) {
  if (number == null || isNaN(number)) return '0'
  
  const formatter = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  })
  
  return formatter.format(number)
}

/**
 * Email validation
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Phone validation (supports various formats)
 */
export function validatePhone(phone) {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Check if it's a valid length (10-15 digits)
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return false
  }
  
  // Basic phone number regex
  const phoneRegex = /^[\+]?[1-9][\d]{0,3}[\s\-\(]?[\d]{1,4}[\s\-\)]?[\d]{1,4}[\s\-]?[\d]{1,9}$/
  return phoneRegex.test(phone)
}

/**
 * Format dates
 */
export function formatDate(date, options = {}) {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) return ''
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  
  const formatter = new Intl.DateTimeFormat('en-NG', {
    ...defaultOptions,
    ...options,
  })
  
  return formatter.format(dateObj)
}

/**
 * Format time
 */
export function formatTime(date, options = {}) {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) return ''
  
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
  
  const formatter = new Intl.DateTimeFormat('en-NG', {
    ...defaultOptions,
    ...options,
  })
  
  return formatter.format(dateObj)
}

/**
 * Format date and time
 */
export function formatDateTime(date, options = {}) {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) return ''
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
  
  const formatter = new Intl.DateTimeFormat('en-NG', {
    ...defaultOptions,
    ...options,
  })
  
  return formatter.format(dateObj)
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date) {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) return ''
  
  const now = new Date()
  const diffInSeconds = Math.floor((now - dateObj) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
  
  return `${Math.floor(diffInSeconds / 31536000)} years ago`
}

/**
 * Truncate text
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + suffix
}

/**
 * Capitalize first letter
 */
export function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Convert to title case
 */
export function toTitleCase(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Generate initials from name
 */
export function getInitials(name, maxLength = 2) {
  if (!name) return ''
  
  const words = name.trim().split(' ')
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('')
  
  return initials
}

/**
 * Generate random ID
 */
export function generateId(prefix = '', length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return prefix + result
}

/**
 * Debounce function
 */
export function debounce(func, wait, immediate = false) {
  let timeout
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    
    if (callNow) func(...args)
  }
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * Check if object is empty
 */
export function isEmpty(obj) {
  if (obj == null) return true
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

/**
 * Sleep function
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Download file from blob
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (err) {
      document.body.removeChild(textArea)
      return false
    }
  }
}

/**
 * Validate email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number (Nigerian format)
 */
export function isValidPhone(phone) {
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/
  return phoneRegex.test(phone.replace(/\s+/g, ''))
}

/**
 * Format phone number
 */
export function formatPhone(phone) {
  if (!phone) return ''
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '')
  
  // Handle Nigerian numbers
  if (cleaned.startsWith('234')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`
  }
  
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }
  
  return phone
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get color based on status
 */
export function getStatusColor(status) {
  const statusColors = {
    // Booking statuses
    pending: 'yellow',
    confirmed: 'blue',
    'in-progress': 'indigo',
    completed: 'green',
    cancelled: 'red',
    'no-show': 'gray',
    
    // Payment statuses
    paid: 'green',
    unpaid: 'red',
    partial: 'yellow',
    refunded: 'gray',
    
    // General statuses
    active: 'green',
    inactive: 'gray',
    draft: 'yellow',
    published: 'green',
    archived: 'gray',
    
    // Stock statuses
    'in-stock': 'green',
    'low-stock': 'yellow',
    'out-of-stock': 'red',
  }
  
  return statusColors[status?.toLowerCase()] || 'gray'
}

/**
 * Generate barcode check digit (for EAN-13)
 */
export function generateBarcodeCheckDigit(barcode) {
  if (!barcode || barcode.length !== 12) return null
  
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit.toString()
}

/**
 * Generate full barcode with check digit
 */
export function generateBarcode(prefix = '200') {
  // Generate 9 random digits
  const randomDigits = Array.from({ length: 9 }, () => 
    Math.floor(Math.random() * 10)
  ).join('')
  
  const barcode = prefix + randomDigits
  const checkDigit = generateBarcodeCheckDigit(barcode)
  
  return barcode + checkDigit
}

export default {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatTime,
  formatDateTime,
  getRelativeTime,
  truncateText,
  capitalize,
  toTitleCase,
  getInitials,
  generateId,
  debounce,
  throttle,
  deepClone,
  isEmpty,
  sleep,
  downloadBlob,
  copyToClipboard,
  isValidEmail,
  isValidPhone,
  formatPhone,
  formatFileSize,
  getStatusColor,
  generateBarcodeCheckDigit,
  generateBarcode,
}