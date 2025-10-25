import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import CryptoJS from 'crypto-js'
import dotenv from 'dotenv'

// Configure dotenv
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-256-bit-encryption-key-change-me'

// Password hashing utilities
const hashPassword = async(password) => {
  try {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  } catch (error) {
    throw new Error('Password hashing failed')
  }
}

const comparePassword = async(password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    throw new Error('Password comparison failed')
  }
}

// Email encryption/decryption utilities
const encryptEmail = (email) => {
  try {
    return CryptoJS.AES.encrypt(email, ENCRYPTION_KEY).toString()
  } catch (error) {
    throw new Error('Email encryption failed')
  }
}

const decryptEmail = (encryptedEmail) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedEmail, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    throw new Error('Email decryption failed')
  }
}

// JWT token generation
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}

// Token extraction from headers
const extractToken = (authHeader) => {
  if (!authHeader) {
    throw new Error('Authorization header missing')
  }
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid authorization format')
  }
  
  return parts[1]
}

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  if (password.length < minLength) {
    throw new Error('Password must be at least 8 characters long')
  }
  if (!hasUpperCase) {
    throw new Error('Password must contain at least one uppercase letter')
  }
  if (!hasLowerCase) {
    throw new Error('Password must contain at least one lowercase letter')
  }
  if (!hasNumbers) {
    throw new Error('Password must contain at least one number')
  }
  if (!hasSpecialChar) {
    throw new Error('Password must contain at least one special character')
  }
  
  return true
}

// Email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format')
  }
  return true
}

// Phone validation
const validatePhone = (phone) => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Check if it's a valid Nigerian phone number
  // Should be 11 digits starting with 0, or 10 digits without leading 0, or 13 digits with +234
  if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
    return true
  } else if (cleanPhone.length === 10) {
    return true
  } else if (cleanPhone.length === 13 && phone.startsWith('+234')) {
    return true
  }
  
  throw new Error('Invalid phone number format')
}

// Helper functions for validation without throwing errors
const isValidEmail = (email) => {
  try {
    validateEmail(email)
    return true
  } catch {
    return false
  }
}

const isValidPhone = (phone) => {
  try {
    validatePhone(phone)
    return true
  } catch {
    return false
  }
}

export {
  hashPassword,
  comparePassword,
  encryptEmail,
  decryptEmail,
  generateToken,
  verifyToken,
  extractToken,
  validatePasswordStrength,
  validateEmail,
  validatePhone,
  isValidEmail,
  isValidPhone,
  JWT_SECRET,
  ENCRYPTION_KEY,
}