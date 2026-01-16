const logger = require('../services/logger');

function adminAuth(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    logger.error('ADMIN_PASSWORD environment variable is not set');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured'
    });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication format. Use: Bearer <password>'
    });
  }

  const token = parts[1];
  
  if (token !== adminPassword) {
    logger.warn(`Failed admin authentication attempt from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid password'
    });
  }

  next();
}

module.exports = adminAuth;