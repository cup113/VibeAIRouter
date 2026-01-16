const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

let currentConfig = {};

function loadConfig() {
  try {
    const configDir = path.join(__dirname, '../../config');
    
    const env = process.env.NODE_ENV || 'development';
    
    const configFiles = [
      'default.json',
      `${env}.json`,
      'local.json'
    ].filter(file => fs.existsSync(path.join(configDir, file)));
    
    let mergedConfig = {};
    
    for (const file of configFiles) {
      const filePath = path.join(configDir, file);
      const fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      mergedConfig = deepMerge(mergedConfig, fileConfig);
    }
    
    mergedConfig.env = process.env.NODE_ENV || mergedConfig.env || 'development';
    mergedConfig.port = process.env.PORT || mergedConfig.port || 3000;
    
    if (process.env.RATE_LIMIT_IP) {
      mergedConfig.rateLimiting.ip.max = parseInt(process.env.RATE_LIMIT_IP);
    }
    
    if (process.env.RATE_LIMIT_GLOBAL) {
      mergedConfig.rateLimiting.global.max = parseInt(process.env.RATE_LIMIT_GLOBAL);
    }
    
    if (process.env.FIRST_TOKEN_TIMEOUT) {
      mergedConfig.timeouts.firstToken = parseInt(process.env.FIRST_TOKEN_TIMEOUT);
    }
    
    if (process.env.TOTAL_TIMEOUT) {
      mergedConfig.timeouts.total = parseInt(process.env.TOTAL_TIMEOUT);
    }
    
    if (process.env.LOG_LEVEL) {
      mergedConfig.logging.level = process.env.LOG_LEVEL;
    }
    
    if (process.env.LOG_REQUESTS) {
      mergedConfig.logging.logRequests = process.env.LOG_REQUESTS === 'true';
    }
    
    currentConfig = mergedConfig;
    
    console.log('Configuration loaded successfully');
    
    return currentConfig;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw error;
  }
}

function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function get(key) {
  const keys = key.split('.');
  let value = currentConfig;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  
  return value;
}

function getAll() {
  return { ...currentConfig };
}

function update(newConfig) {
  try {
    currentConfig = deepMerge(currentConfig, newConfig);
    console.log('Configuration updated successfully');
    return currentConfig;
  } catch (error) {
    console.error('Failed to update configuration:', error);
    throw error;
  }
}

function watchConfigFiles() {
  const configDir = path.join(__dirname, '../../config');
  const watcher = chokidar.watch(configDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  });
  
  watcher.on('change', (filePath) => {
    console.log(`Configuration file changed: ${path.basename(filePath)}`);
    loadConfig();
  });
  
  watcher.on('error', (error) => {
    console.error('Config watcher error:', error);
  });
  
  console.log('Configuration file watcher started');
}

loadConfig();

if (process.env.NODE_ENV !== 'production') {
  watchConfigFiles();
}

module.exports = {
  get,
  getAll,
  update,
  loadConfig
};