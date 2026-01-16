const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', (req, res) => {
  try {
    const modelsConfig = config.get('models');
    
    const allModels = [];
    
    const siliconflowModels = modelsConfig.siliconflow || [];
    const giteeModels = modelsConfig.gitee || [];
    
    for (const model of siliconflowModels) {
      allModels.push({
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'siliconflow',
        permission: [
          {
            id: `perm-${model.replace(/\//g, '-')}`,
            object: 'model_permission',
            created: Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group: null,
            is_blocking: false
          }
        ],
        root: model,
        parent: null
      });
    }
    
    for (const model of giteeModels) {
      allModels.push({
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'gitee',
        permission: [
          {
            id: `perm-${model.replace(/\//g, '-')}`,
            object: 'model_permission',
            created: Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group: null,
            is_blocking: false
          }
        ],
        root: model,
        parent: null
      });
    }
    
    res.json({
      object: 'list',
      data: allModels
    });
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'server_error'
      }
    });
  }
});

router.get('/:modelId', (req, res) => {
  try {
    const modelId = req.params.modelId;
    const modelsConfig = config.get('models');
    
    const modelMapping = modelsConfig.mapping || {};
    const providerId = modelMapping[modelId];
    
    if (!providerId) {
      return res.status(404).json({
        error: {
          message: `The model '${modelId}' does not exist`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      });
    }
    
    const ownedBy = providerId === 'siliconflow' ? 'siliconflow' : 'gitee';
    
    res.json({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: ownedBy,
      permission: [
        {
          id: `perm-${modelId.replace(/\//g, '-')}`,
          object: 'model_permission',
          created: Math.floor(Date.now() / 1000),
          allow_create_engine: false,
          allow_sampling: true,
          allow_logprobs: true,
          allow_search_indices: false,
          allow_view: true,
          allow_fine_tuning: false,
          organization: '*',
          group: null,
          is_blocking: false
        }
      ],
      root: modelId,
      parent: null
    });
  } catch (error) {
    console.error('Error getting model:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'server_error'
      }
    });
  }
});

module.exports = router;