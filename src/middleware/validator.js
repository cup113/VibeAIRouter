const config = require('../config');

function validateRequest(req, res, next) {
  const securityConfig = config.get('security');
  
  if (!req.body) {
    return res.status(400).json({
      error: {
        message: 'Request body is required',
        type: 'invalid_request_error',
        code: 'missing_body'
      }
    });
  }
  
  if (req.body.max_tokens && req.body.max_tokens > securityConfig.maxTokens) {
    return res.status(400).json({
      error: {
        message: `max_tokens exceeds maximum allowed value of ${securityConfig.maxTokens}`,
        type: 'invalid_request_error',
        code: 'max_tokens_exceeded'
      }
    });
  }
  
  if (req.body.messages && req.body.messages.length > securityConfig.maxMessages) {
    return res.status(400).json({
      error: {
        message: `Number of messages exceeds maximum allowed value of ${securityConfig.maxMessages}`,
        type: 'invalid_request_error',
        code: 'max_messages_exceeded'
      }
    });
  }
  
  if (req.body.messages && !Array.isArray(req.body.messages)) {
    return res.status(400).json({
      error: {
        message: 'messages must be an array',
        type: 'invalid_request_error',
        code: 'invalid_messages'
      }
    });
  }
  
  if (req.body.messages) {
    for (let i = 0; i < req.body.messages.length; i++) {
      const message = req.body.messages[i];
      
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        return res.status(400).json({
          error: {
            message: `Invalid role at message index ${i}`,
            type: 'invalid_request_error',
            code: 'invalid_role'
          }
        });
      }
      
      if (!message.content && message.role !== 'assistant') {
        return res.status(400).json({
          error: {
            message: `Missing content at message index ${i}`,
            type: 'invalid_request_error',
            code: 'missing_content'
          }
        });
      }
    }
  }
  
  next();
}

module.exports = validateRequest;