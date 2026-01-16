const config = require('../config');
const logger = require('../services/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const logRequests = config.get('logging.logRequests');
    
    if (!logRequests) {
      return;
    }
    
    const excludeFields = config.get('logging.excludeFields') || [];
    
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };
    
    if (req.body && Object.keys(req.body).length > 0) {
      const filteredBody = { ...req.body };
      
      for (const field of excludeFields) {
        if (filteredBody[field]) {
          filteredBody[field] = '[REDACTED]';
        }
      }
      
      if (filteredBody.messages && Array.isArray(filteredBody.messages)) {
        filteredBody.messages = filteredBody.messages.map(msg => ({
          role: msg.role,
          content: msg.content ? '[REDACTED]' : undefined
        }));
      }
      
      logData.requestBody = filteredBody;
    }
    
    logger.info('Request completed', logData);
  });
  
  next();
}

module.exports = requestLogger;