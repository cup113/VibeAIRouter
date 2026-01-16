const express = require('express');
const router = express.Router();
// 暂时使用旧的providerManager，稍后切换
const providerManager = require('../services/providerManager');
const validateRequest = require('../middleware/validator');
const logger = require('../services/logger');

router.post('/', validateRequest, async (req, res, next) => {
  try {
    const request = {
      ...req.body
    };
    
    if (!request.model) {
      request.model = 'Qwen/Qwen3-8B';
    }
    
    logger.debug(`Processing chat completion request for model: ${request.model}, stream: ${request.stream}`);
    
    if (request.stream) {
      const response = await providerManager.forwardRequest(request, res);
      return response;
    } else {
      const response = await providerManager.forwardRequest(request);
      res.json(response);
    }
  } catch (error) {
    // 错误现在由全局错误处理中间件处理
    next(error);
  }
});

module.exports = router;