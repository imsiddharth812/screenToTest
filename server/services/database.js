const sqlite3 = require('sqlite3').verbose()
const { promisify } = require('util')
const { config } = require('../config/config')
const logger = require('../utils/logger')

class DatabaseService {
  constructor() {
    this.db = null
    this.isInitialized = false
  }

  async initialize() {
    try {
      logger.info('Initializing database connection...')
      
      this.db = new sqlite3.Database(config.DATABASE_URL, (err) => {
        if (err) {
          logger.error('Error opening database:', err.message)
          throw err
        }
        logger.info(`Connected to SQLite database at ${config.DATABASE_URL}`)
      })

      // Promisify database methods for async/await support
      this.db.getAsync = promisify(this.db.get).bind(this.db)
      this.db.allAsync = promisify(this.db.all).bind(this.db)
      this.db.runAsync = promisify(this.db.run).bind(this.db)

      // Enable foreign keys for cascade deletion
      await this.db.runAsync('PRAGMA foreign_keys = ON')
      logger.info('Foreign keys enabled for cascade deletion')

      await this.createTables()
      await this.createIndexes()
      await this.runMigrations()
      
      this.isInitialized = true
      logger.info('Database initialization completed successfully')
    } catch (error) {
      logger.error('Database initialization failed:', error)
      throw error
    }
  }

  async createTables() {
    logger.info('Creating/verifying database tables...')

    const tables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: 'projects',
        sql: `
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'features',
        sql: `
          CREATE TABLE IF NOT EXISTS features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'scenarios',
        sql: `
          CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_id INTEGER NOT NULL,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            testing_intent VARCHAR(50) DEFAULT 'comprehensive',
            ai_model VARCHAR(20) DEFAULT 'claude',
            user_story TEXT,
            acceptance_criteria TEXT,
            business_rules TEXT,
            edge_cases TEXT,
            test_environment TEXT,
            coverage_level VARCHAR(20) DEFAULT 'comprehensive',
            test_types JSON DEFAULT '[\"positive\",\"negative\",\"edge_cases\"]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'screenshots',
        sql: `
          CREATE TABLE IF NOT EXISTS screenshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            custom_name VARCHAR(255),
            file_path TEXT NOT NULL,
            file_size INTEGER,
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'test_cases',
        sql: `
          CREATE TABLE IF NOT EXISTS test_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            analysis_type VARCHAR(50) NOT NULL DEFAULT 'standard',
            test_case_data TEXT NOT NULL,
            total_test_cases INTEGER DEFAULT 0,
            functional_count INTEGER DEFAULT 0,
            end_to_end_count INTEGER DEFAULT 0,
            integration_count INTEGER DEFAULT 0,
            ui_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
          )
        `
      }
    ]

    for (const table of tables) {
      try {
        await this.db.runAsync(table.sql)
        logger.debug(`✓ ${table.name} table created/verified`)
      } catch (error) {
        logger.error(`Error creating ${table.name} table:`, error.message)
        throw error
      }
    }

    logger.info('All database tables created/verified successfully')
  }

  async createIndexes() {
    logger.info('Creating database indexes...')

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_features_project_id ON features(project_id)', 
      'CREATE INDEX IF NOT EXISTS idx_scenarios_feature_id ON scenarios(feature_id)',
      'CREATE INDEX IF NOT EXISTS idx_screenshots_scenario_id ON screenshots(scenario_id)',
      'CREATE INDEX IF NOT EXISTS idx_screenshots_order ON screenshots(scenario_id, order_index)',
      'CREATE INDEX IF NOT EXISTS idx_test_cases_scenario_id ON test_cases(scenario_id)',
      'CREATE INDEX IF NOT EXISTS idx_test_cases_analysis_type ON test_cases(scenario_id, analysis_type)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_scenarios_updated_at ON scenarios(updated_at)'
    ]

    for (const indexSql of indexes) {
      try {
        await this.db.runAsync(indexSql)
      } catch (error) {
        logger.error('Error creating index:', error.message)
      }
    }

    logger.info('Database indexes created successfully')
  }

  async runMigrations() {
    logger.info('Running database migrations...')

    try {
      // Check if new columns exist, if not add them
      const rows = await this.db.allAsync("PRAGMA table_info(scenarios)")
      const existingColumns = rows.map(row => row.name)
      
      const newColumns = [
        { name: 'testing_intent', sql: 'ALTER TABLE scenarios ADD COLUMN testing_intent VARCHAR(50) DEFAULT "comprehensive"' },
        { name: 'ai_model', sql: 'ALTER TABLE scenarios ADD COLUMN ai_model VARCHAR(20) DEFAULT "claude"' },
        { name: 'user_story', sql: 'ALTER TABLE scenarios ADD COLUMN user_story TEXT' },
        { name: 'acceptance_criteria', sql: 'ALTER TABLE scenarios ADD COLUMN acceptance_criteria TEXT' },
        { name: 'business_rules', sql: 'ALTER TABLE scenarios ADD COLUMN business_rules TEXT' },
        { name: 'edge_cases', sql: 'ALTER TABLE scenarios ADD COLUMN edge_cases TEXT' },
        { name: 'test_environment', sql: 'ALTER TABLE scenarios ADD COLUMN test_environment TEXT' },
        { name: 'coverage_level', sql: 'ALTER TABLE scenarios ADD COLUMN coverage_level VARCHAR(20) DEFAULT "comprehensive"' },
        { name: 'test_types', sql: 'ALTER TABLE scenarios ADD COLUMN test_types JSON DEFAULT \'[\"positive\",\"negative\",\"edge_cases\"]\'' }
      ]

      for (const column of newColumns) {
        if (!existingColumns.includes(column.name)) {
          try {
            await this.db.runAsync(column.sql)
            logger.info(`✓ Added column: ${column.name}`)
          } catch (error) {
            logger.error(`Error adding column ${column.name}:`, error.message)
          }
        }
      }

      logger.info('Database migrations completed successfully')
    } catch (error) {
      logger.error('Error running migrations:', error)
      throw error
    }
  }

  // Helper methods for common database operations
  async get(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized')
    }
    return await this.db.getAsync(sql, params)
  }

  async all(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized')
    }
    return await this.db.allAsync(sql, params)
  }

  async run(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized')
    }
    return await this.db.runAsync(sql, params)
  }

  // Transaction helper
  async transaction(callback) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized')
    }
    
    await this.db.runAsync('BEGIN TRANSACTION')
    try {
      const result = await callback(this)
      await this.db.runAsync('COMMIT')
      return result
    } catch (error) {
      await this.db.runAsync('ROLLBACK')
      throw error
    }
  }

  // Close database connection
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err)
            reject(err)
          } else {
            logger.info('Database connection closed')
            resolve()
          }
        })
      })
    }
  }

  // Get the raw database instance for backward compatibility
  getDatabase() {
    return this.db
  }
}

// Create singleton instance
const databaseService = new DatabaseService()

module.exports = databaseService
