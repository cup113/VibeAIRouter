const express = require('express');
const router = express.Router();
const providerManager = require('../services/providerManager');
const config = require('../config');

router.get('/', async (req, res) => {
  try {
    const healthResults = await providerManager.checkAllProvidersHealth();
    
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.get('env'),
      services: {}
    };
    
    let allHealthy = true;
    
    for (const [providerId, result] of Object.entries(healthResults)) {
      status.services[providerId] = {
        status: result.healthy ? 'up' : 'down',
        test_model: providerId === 'siliconflow' ? 'Qwen/Qwen3-8B' : 'Lingshu-32B',
        details: result.status || result.error
      };
      
      if (!result.healthy) {
        allHealthy = false;
      }
    }
    
    if (!allHealthy) {
      status.status = 'degraded';
    }
    
    if (Object.keys(healthResults).length === 0) {
      status.status = 'unhealthy';
      status.services = { error: 'No providers configured' };
    }
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;