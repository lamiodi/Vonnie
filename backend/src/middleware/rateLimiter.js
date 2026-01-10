import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/apiResponse.js';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: errorResponse(
    'Too many login attempts from this IP, please try again after 15 minutes',
    'TOO_MANY_REQUESTS',
    429
  ),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
