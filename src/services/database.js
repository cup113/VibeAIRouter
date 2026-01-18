const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/vibeai.db');
  }
  
  connect() {
    if (!this.db) {
      try {
        this.db = new Database(this.dbPath);
        this.initDatabase();
        logger.info('Database connected successfully');
      } catch (error) {
        logger.error('Failed to connect to database:', error);
        throw error;
      }
    }
    return this.db;
  }

  initDatabase() {
    this.connect().exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        success INTEGER NOT NULL,
        response_time INTEGER,
        tokens_used INTEGER,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS provider_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hour DATETIME NOT NULL,
        provider TEXT NOT NULL,
        total_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        UNIQUE(hour, provider)
      );

      CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
      CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider);
      CREATE INDEX IF NOT EXISTS idx_provider_stats_hour ON provider_stats(hour);
    `);

    logger.info('Database initialized');
  }

  recordRequest(data) {
    try {
      const stmt = this.connect().prepare(`
        INSERT INTO requests (model, provider, success, response_time, tokens_used, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.model,
        data.provider,
        data.success ? 1 : 0,
        data.responseTime,
        data.tokensUsed,
        data.errorMessage
      );
    } catch (error) {
      logger.error('Failed to record request:', error);
    }
  }

  updateHourlyStats() {
    const now = new Date();
    const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    const stats = this.connect().prepare(`
      SELECT 
        provider,
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        AVG(response_time) as avg_response_time,
        SUM(tokens_used) as total_tokens
      FROM requests
      WHERE timestamp >= datetime(?, '-1 hour')
      GROUP BY provider
    `).all(hour.toISOString());

    const insertStmt = this.connect().prepare(`
      INSERT OR REPLACE INTO provider_stats (hour, provider, total_requests, successful_requests, avg_response_time, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const stat of stats) {
      insertStmt.run(
        hour.toISOString(),
        stat.provider,
        stat.total_requests,
        stat.successful_requests,
        stat.avg_response_time,
        stat.total_tokens
      );
    }

    return stats.length;
  }

  getStats(timeRange = '24h') {
    let whereClause = '';
    const params = [];

    if (timeRange === '24h') {
      whereClause = "WHERE timestamp >= datetime('now', '-24 hours')";
    } else if (timeRange === '7d') {
      whereClause = "WHERE timestamp >= datetime('now', '-7 days')";
    } else if (timeRange === '30d') {
      whereClause = "WHERE timestamp >= datetime('now', '-30 days')";
    }

    const overall = this.connect().prepare(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        AVG(response_time) as avg_response_time,
        SUM(tokens_used) as total_tokens
      FROM requests
      ${whereClause}
    `).get(...params);

    const byProvider = this.connect().prepare(`
      SELECT 
        provider,
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        AVG(response_time) as avg_response_time,
        SUM(tokens_used) as total_tokens
      FROM requests
      ${whereClause}
      GROUP BY provider
      ORDER BY total_requests DESC
    `).all(...params);

    const hourlyStats = this.connect().prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', hour) as hour,
        provider,
        total_requests,
        successful_requests,
        avg_response_time,
        total_tokens
      FROM provider_stats
      WHERE hour >= datetime('now', '-24 hours')
      ORDER BY hour DESC, provider
    `).all();

    return {
      overall,
      byProvider,
      hourlyStats,
      timestamp: new Date().toISOString()
    };
  }

  getRecentRequests(limit = 50) {
    return this.connect().prepare(`
      SELECT 
        id,
        timestamp,
        model,
        provider,
        success,
        response_time,
        tokens_used,
        error_message
      FROM requests
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
  }

  logAdminAction(action, details, ipAddress) {
    const stmt = this.connect().prepare(`
      INSERT INTO admin_logs (action, details, ip_address)
      VALUES (?, ?, ?)
    `);

    stmt.run(action, details, ipAddress);
  }

  getAdminLogs(limit = 100) {
    return this.connect().prepare(`
      SELECT 
        id,
        timestamp,
        action,
        details,
        ip_address
      FROM admin_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
  }

  cleanupOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requestsDeleted = this.connect().prepare(`
      DELETE FROM requests 
      WHERE timestamp < ?
    `).run(thirtyDaysAgo.toISOString()).changes;

    const statsDeleted = this.connect().prepare(`
      DELETE FROM provider_stats 
      WHERE hour < ?
    `).run(thirtyDaysAgo.toISOString()).changes;

    const logsDeleted = this.connect().prepare(`
      DELETE FROM admin_logs 
      WHERE timestamp < ?
    `).run(thirtyDaysAgo.toISOString()).changes;

    return { requestsDeleted, statsDeleted, logsDeleted };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new DatabaseService();