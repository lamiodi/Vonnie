// Format currency amount
export const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '₦0.00';
  return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Get Nigeria timezone offset (WAT - West Africa Time)
const NIGERIA_TIMEZONE = 'Africa/Lagos';

// Format date and time with proper timezone handling
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  return dateObj.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: NIGERIA_TIMEZONE
  });
};

// Format date only with timezone handling
export const formatDate = (date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  return dateObj.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: NIGERIA_TIMEZONE
  });
};

// Format time only with timezone handling
export const formatTime = (date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Time';
  
  return dateObj.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: NIGERIA_TIMEZONE
  });
};

// Create Nigeria timezone ISO string
export const createNigeriaISOString = () => {
  const now = new Date();
  const nigeriaTime = new Date(now.toLocaleString("en-US", {timeZone: NIGERIA_TIMEZONE}));
  return nigeriaTime.toISOString();
};

// Convert date/time to Nigeria timezone ISO string
export const convertToNigeriaISOString = (date) => {
  if (!date) return new Date().toISOString();
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return new Date().toISOString();
  
  // Convert to Nigeria timezone and back to ISO string
  const nigeriaTime = new Date(dateObj.toLocaleString("en-US", {timeZone: NIGERIA_TIMEZONE}));
  return nigeriaTime.toISOString();
};