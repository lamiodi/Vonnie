import { verifyToken, extractToken } from '../utils/auth.js'
import { sql } from '../config/database.js'

// Authentication middleware
const authenticate = async(req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = extractToken(authHeader)
    
    const decoded = verifyToken(token)
    
    // Fetch user from database using custom users table
    const users = await sql`
      SELECT * FROM users WHERE id = ${decoded.userId}
    `

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    const user = users[0]

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
}

// Authorization middleware for specific roles
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    
    next()
  }
}

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async(req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader) {
      const token = extractToken(authHeader)
      const decoded = verifyToken(token)
      
      const users = await sql`
        SELECT * FROM users WHERE id = ${decoded.userId}
      `
      
      if (users.length > 0 && users[0].is_active) {
        req.user = users[0]
      }
    }
    
    next()
  } catch (error) {
    // Continue without authentication if token is invalid
    next()
  }
}

// Convenience middleware functions
const authenticateToken = authenticate
const requireStaff = authorize(['staff', 'admin', 'manager'])
const requireAdmin = authorize(['admin'])
const requireManager = authorize(['manager', 'admin'])

export {
  authenticate,
  authorize,
  optionalAuth,
  authenticateToken,
  requireStaff,
  requireAdmin,
  requireManager,
}