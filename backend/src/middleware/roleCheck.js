import { authorize } from './auth.js';

// Export specific role checkers
export const checkManagerRole = authorize(['admin', 'manager']);
export const checkAdminRole = authorize(['admin']);
export const checkStaffRole = authorize(['admin', 'manager', 'staff']);