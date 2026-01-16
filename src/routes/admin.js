const express = require('express');
const router = express.Router();
const config = require('../config');
const providerManager = require('../services/providerManager');
const database = require('../services/database');
const logger = require('../services/logger');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.post('/reload-config', (req, res) => {
  try {
    config.loadConfig();
    providerManager.reloadConfig();
    
    logger.info('Configuration reloaded via admin endpoint');
    
    database.logAdminAction('reload_config', 'Configuration reloaded', req.ip);
    
    res.json({
      success: true,
      message: 'Configuration reloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to reload configuration:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/save-config', (req, res) => {
  try {
    const newConfig = req.body.config;
    
    if (!newConfig) {
      return res.status(400).json({
        success: false,
        error: 'No configuration provided'
      });
    }
    
    const fs = require('fs');
    const path = require('path');
    
    const configDir = path.join(__dirname, '../../config');
    const localConfigPath = path.join(configDir, 'local.json');
    
    fs.writeFileSync(localConfigPath, JSON.stringify(newConfig, null, 2), 'utf8');
    
    config.loadConfig();
    providerManager.reloadConfig();
    
    logger.info('Configuration saved via admin endpoint');
    
    database.logAdminAction('save_config', 'Configuration saved to local.json', req.ip);
    
    res.json({
      success: true,
      message: 'Configuration saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to save configuration:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/config', (req, res) => {
  try {
    const currentConfig = config.getAll();
    
    const safeConfig = { ...currentConfig };
    
    if (safeConfig.providers) {
      for (const provider of Object.values(safeConfig.providers)) {
        if (provider.apiKey) {
          provider.apiKey = '***REDACTED***';
        }
      }
    }
    
    res.json({
      success: true,
      config: safeConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get configuration:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/status', (req, res) => {
  try {
    const providerStatus = providerManager.getProviderStatus();
    
    res.json({
      success: true,
      providers: providerStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider status:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/stats', (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    const stats = database.getStats(timeRange);
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get statistics:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/requests', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const requests = database.getRecentRequests(limit);
    
    res.json({
      success: true,
      requests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get recent requests:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = database.getAdminLogs(limit);
    
    res.json({
      success: true,
      logs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get admin logs:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/cleanup', (req, res) => {
  try {
    const result = database.cleanupOldData();
    
    database.logAdminAction('cleanup_data', `Cleaned up ${JSON.stringify(result)}`, req.ip);
    
    res.json({
      success: true,
      message: 'Old data cleaned up successfully',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cleanup old data:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/update-hourly-stats', (req, res) => {
  try {
    const updated = database.updateHourlyStats();
    
    database.logAdminAction('update_stats', `Updated ${updated} hourly stats`, req.ip);
    
    res.json({
      success: true,
      message: 'Hourly statistics updated',
      updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update hourly stats:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;