const mysql = require('mysql2/promise');
const path = require('path');

// Loads environment configuration for MySQL from .env file.
require('dotenv').config({ 
    path: path.join(__dirname, '..', 'Config', 'credentials.env'),
    override: false,
    debug: false,
    quiet: true
});

class MySQLConnection {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: process.env.MYSQL_HOST || 'localhost',
                port: parseInt(process.env.MYSQL_PORT) || 3306,
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD || '',
                database: process.env.MYSQL_DATABASE || 'discord_bot',
                connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT) || 10,
                queueLimit: parseInt(process.env.MYSQL_QUEUE_LIMIT) || 0,
                waitForConnections: true,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
                connectTimeout: 10000
            });

            // Test the database connection to make sure everything works.
            const connection = await this.pool.getConnection();
            console.log('✅ MySQL Connected Successfully');
            connection.release();
            
            this.isConnected = true;
            await this.initializeTables();
            
            return true;
        } catch (error) {
            console.error('❌ MySQL Connection Failed:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    async initializeTables() {
        try {
            // Create the userinfo table for storing user data if it doesn't exist yet.
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS userinfo (
                    user_id BIGINT UNSIGNED PRIMARY KEY,
                    username VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    is_bot BOOLEAN DEFAULT FALSE,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Create levels table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS levels (
                    user_id VARCHAR(20) PRIMARY KEY,
                    username VARCHAR(32),
                    xp INT DEFAULT 0,
                    level INT DEFAULT 1,
                    messages INT DEFAULT 0,
                    total_xp INT DEFAULT 0,
                    last_message BIGINT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Add total_xp column to levels table if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE levels ADD COLUMN total_xp INT DEFAULT 0
                `);
            } catch (err) {
                // Column already exists, ignore error
                if (!err.message.includes('Duplicate column')) {
                    console.warn('[MySQL] Could not add total_xp column:', err.message);
                }
            }

            // Create warns table (legacy - keeping for compatibility)
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS warns (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    case_id VARCHAR(50) NOT NULL,
                    reason TEXT,
                    moderator_id VARCHAR(20),
                    user_name VARCHAR(100) DEFAULT NULL,
                    moderator_name VARCHAR(100) DEFAULT NULL,
                    moderator_source VARCHAR(20) DEFAULT NULL,
                    type VARCHAR(50),
                    timestamp BIGINT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_case (user_id, case_id),
                    INDEX idx_user (user_id),
                    INDEX idx_type (type)
                )
            `);

            // Add missing warns columns (migration)
            const warnsColumnsToAdd = [
                { name: 'user_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'moderator_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'moderator_source', type: 'VARCHAR(20) DEFAULT NULL' }
            ];
            for (const col of warnsColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE warns ADD COLUMN ${col.name} ${col.type}
                    `);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name} to warns:`, err.message);
                    }
                }
            }

            // Add index to speed up latest-warning lookups
            try {
                await this.pool.execute(
                    'CREATE INDEX idx_warns_user_timestamp ON warns(user_id, timestamp)'
                );
                console.log("✅ Added index 'idx_warns_user_timestamp' to warns table");
            } catch (err) {
                if (err.code === 'ER_DUP_KEYNAME') {
                    // Index already exists, skip
                } else {
                    console.error("Error adding index idx_warns_user_timestamp:", err.message);
                }
            }

            // Create user_bans table (only for ban status tracking)
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS user_bans (
                    user_id VARCHAR(20) PRIMARY KEY,
                    banned BOOLEAN DEFAULT FALSE,
                    ban_case_id VARCHAR(50) DEFAULT NULL,
                    banned_at TIMESTAMP NULL,
                    banned_by VARCHAR(20) DEFAULT NULL,
                    ban_reason TEXT DEFAULT NULL,
                    user_name VARCHAR(100) DEFAULT NULL,
                    banned_by_name VARCHAR(100) DEFAULT NULL,
                    banned_by_source VARCHAR(20) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_banned (banned),
                    INDEX idx_banned_at (banned_at)
                )
            `);

            // Add missing user_bans columns (migration)
            const userBansColumnsToAdd = [
                { name: 'user_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'banned_by_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'banned_by_source', type: 'VARCHAR(20) DEFAULT NULL' }
            ];
            for (const col of userBansColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE user_bans ADD COLUMN ${col.name} ${col.type}
                    `);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name} to user_bans:`, err.message);
                    }
                }
            }

            // Create unbans table (tracks unban actions and case IDs)
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS unbans (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    unban_case_id VARCHAR(50) NOT NULL,
                    unbanned_at TIMESTAMP NULL,
                    unbanned_by VARCHAR(255) DEFAULT NULL,
                    unbanned_by_name VARCHAR(100) DEFAULT NULL,
                    unbanned_by_source VARCHAR(20) DEFAULT NULL,
                    user_name VARCHAR(100) DEFAULT NULL,
                    original_ban_case_id VARCHAR(50) DEFAULT NULL,
                    original_ban_reason TEXT DEFAULT NULL,
                    reason TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_unbans_user (user_id),
                    INDEX idx_unbans_case (unban_case_id),
                    INDEX idx_unbans_time (unbanned_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Add missing unbans columns (migration)
            const unbansColumnsToAdd = [
                { name: 'unbanned_by_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'unbanned_by_source', type: 'VARCHAR(20) DEFAULT NULL' },
                { name: 'user_name', type: 'VARCHAR(100) DEFAULT NULL' }
            ];
            for (const col of unbansColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE unbans ADD COLUMN ${col.name} ${col.type}
                    `);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name} to unbans:`, err.message);
                    }
                }
            }

            // Create reminders table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS reminders (
                    id VARCHAR(50) PRIMARY KEY,
                    case_id VARCHAR(20) UNIQUE,
                    user_id VARCHAR(20) NOT NULL,
                    message TEXT,
                    text TEXT,
                    timestamp BIGINT,
                    created_at BIGINT,
                    trigger_at BIGINT,
                    channel_id VARCHAR(20),
                    guild_id VARCHAR(20),
                    completed BOOLEAN DEFAULT FALSE,
                    delivery_attempts INT DEFAULT 0,
                    last_failure_reason TEXT,
                    last_failure_time BIGINT,
                    INDEX idx_user (user_id),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_trigger (trigger_at),
                    INDEX idx_completed (completed)
                )
            `);
            
            // Add case_id column if it doesn't exist (migration)
            try {
                await this.pool.execute(`
                    ALTER TABLE reminders 
                    ADD COLUMN IF NOT EXISTS case_id VARCHAR(20) UNIQUE
                `);
            } catch (err) {
                // Column might already exist, ignore error
                if (!err.message.includes('Duplicate column')) {
                    console.error(`Note: case_id column migration:`, err.message);
                }
            }
            
            const columnsToAdd = [
                { name: 'message', type: 'TEXT' },
                { name: 'text', type: 'TEXT' },
                { name: 'timestamp', type: 'BIGINT' },
                { name: 'created_at', type: 'BIGINT' },
                { name: 'trigger_at', type: 'BIGINT' },
                { name: 'channel_id', type: 'VARCHAR(20)' },
                { name: 'guild_id', type: 'VARCHAR(20)' },
                { name: 'completed', type: 'BOOLEAN DEFAULT FALSE' },
                { name: 'delivery_attempts', type: 'INT DEFAULT 0' },
                { name: 'last_failure_reason', type: 'TEXT' },
                { name: 'last_failure_time', type: 'BIGINT' }
            ];
            
            for (const col of columnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE reminders ADD COLUMN ${col.name} ${col.type}
                    `);
                    console.log(`✅ Added column '${col.name}' to reminders table`);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name}:`, err.message);
                    }
                }
            }
            
            // Add indexes if they don't exist
            const indexesToAdd = [
                { name: 'idx_trigger', column: 'trigger_at' },
                { name: 'idx_completed', column: 'completed' }
            ];
            
            for (const idx of indexesToAdd) {
                try {
                    await this.pool.execute(`
                        CREATE INDEX ${idx.name} ON reminders(${idx.column})
                    `);
                    console.log(`✅ Added index '${idx.name}' to reminders table`);
                } catch (err) {
                    if (err.code === 'ER_DUP_KEYNAME') {
                        // Index already exists, skip
                    } else {
                        console.error(`Error adding index ${idx.name}:`, err.message);
                    }
                }
            }

            // Migrate user_bans table to add missing columns
            const banColumnsToAdd = [
                { name: 'ban_case_id', type: 'VARCHAR(50) DEFAULT NULL' },
                { name: 'banned_at', type: 'TIMESTAMP NULL' },
                { name: 'banned_by', type: 'VARCHAR(20) DEFAULT NULL' },
                { name: 'ban_reason', type: 'TEXT DEFAULT NULL' }
            ];
            
            for (const col of banColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE user_bans ADD COLUMN ${col.name} ${col.type}
                    `);
                    console.log(`✅ Added column '${col.name}' to user_bans table`);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name}:`, err.message);
                    }
                }
            }
            
            // Add indexes to user_bans if they don't exist
            const banIndexesToAdd = [
                { name: 'idx_banned_at', column: 'banned_at' }
            ];
            
            for (const idx of banIndexesToAdd) {
                try {
                    await this.pool.execute(`
                        CREATE INDEX ${idx.name} ON user_bans(${idx.column})
                    `);
                    console.log(`✅ Added index '${idx.name}' to user_bans table`);
                } catch (err) {
                    if (err.code === 'ER_DUP_KEYNAME') {
                        // Index already exists, skip
                    } else {
                        console.error(`Error adding index ${idx.name}:`, err.message);
                    }
                }
            }
            
            // Migrate levels table to add username column
            try {
                await this.pool.execute(`
                    ALTER TABLE levels ADD COLUMN username VARCHAR(32) DEFAULT NULL
                `);
                console.log(`✅ Added username column to levels table`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error(`Error adding username column:`, err.message);
                }
            }
            
            // Migrate admin_users table to update role enum
            try {
                await this.pool.execute(`
                    ALTER TABLE admin_users MODIFY COLUMN role ENUM('owner', 'admin', 'moderator') DEFAULT 'moderator'
                `);
                console.log(`✅ Updated role enum in admin_users table`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column doesn't exist, skip
                } else {
                    console.error(`Error updating role enum:`, err.message);
                }
            }

            // Create giveaways table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS giveaways (
                    id VARCHAR(50) PRIMARY KEY,
                    case_id VARCHAR(20) UNIQUE,
                    prize TEXT,
                    title TEXT,
                    channel_id VARCHAR(20),
                    message_id VARCHAR(20),
                    host_id VARCHAR(20),
                    end_time BIGINT,
                    winner_count INT DEFAULT 1,
                    ended BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            
            // Add case_id column if it doesn't exist (migration)
            try {
                await this.pool.execute(`
                    ALTER TABLE giveaways 
                    ADD COLUMN IF NOT EXISTS case_id VARCHAR(20) UNIQUE
                `);
            } catch (err) {
                // Column might already exist, ignore error
                if (!err.message.includes('Duplicate column')) {
                    console.error(`Note: case_id column migration:`, err.message);
                }
            }

            // Create giveaway_entries table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS giveaway_entries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    giveaway_id VARCHAR(50) NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_entry (giveaway_id, user_id),
                    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
                )
            `);

            // Create tickets table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS tickets (
                    channel_id VARCHAR(20) PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    user_name VARCHAR(100) NOT NULL,
                    reason TEXT,
                    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
                    created_at BIGINT NOT NULL,
                    claimed_by VARCHAR(20) DEFAULT NULL,
                    status ENUM('open', 'claimed', 'closed') DEFAULT 'open',
                    closed_at BIGINT DEFAULT NULL,
                    closed_by VARCHAR(20) DEFAULT NULL,
                    close_reason TEXT DEFAULT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_status (status),
                    INDEX idx_priority (priority)
                )
            `);

            // Create join_to_create table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS join_to_create (
                    channel_id VARCHAR(20) PRIMARY KEY,
                    owner_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    channel_name VARCHAR(100) NOT NULL,
                    created_at BIGINT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    INDEX idx_owner_id (owner_id),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_is_active (is_active)
                )
            `);

            // Create admin_users table for panel authentication
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role ENUM('owner', 'admin', 'moderator') DEFAULT 'moderator',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL DEFAULT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    INDEX idx_username (username),
                    INDEX idx_active (active)
                )
            `);

            // Create advanced logging table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    event_type ENUM('MESSAGE_DELETE', 'MESSAGE_EDIT', 'MEMBER_JOIN', 'MEMBER_LEAVE', 
                                   'MEMBER_BAN', 'MEMBER_UNBAN', 'MEMBER_KICK', 'ROLE_ADD', 'ROLE_REMOVE',
                                   'CHANNEL_CREATE', 'CHANNEL_DELETE', 'VOICE_JOIN', 'VOICE_LEAVE', 'VOICE_MOVE',
                                   'NICKNAME_CHANGE', 'USERNAME_CHANGE', 'WARN', 'TIMEOUT', 'OTHER') NOT NULL,
                    user_id VARCHAR(20),
                    moderator_id VARCHAR(20),
                    channel_id VARCHAR(20),
                    before_content TEXT,
                    after_content TEXT,
                    reason TEXT,
                    metadata JSON,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_event_type (event_type),
                    INDEX idx_user_id (user_id),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_timestamp (timestamp)
                )
            `);

            // Create suggestions table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS suggestions (
                    suggestion_id INT AUTO_INCREMENT PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    title VARCHAR(100) NOT NULL,
                    description TEXT NOT NULL,
                    message_id VARCHAR(20),
                    status ENUM('pending', 'approved', 'denied', 'implemented') DEFAULT 'pending',
                    upvotes INT DEFAULT 0,
                    downvotes INT DEFAULT 0,
                    admin_response TEXT,
                    responded_by VARCHAR(20),
                    resolved_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_message_id (message_id)
                )
            `);

            // Create suggestion votes table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS suggestion_votes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    suggestion_id VARCHAR(20) NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    vote_type ENUM('upvote', 'downvote') NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_vote (suggestion_id, user_id),
                    INDEX idx_suggestion_id (suggestion_id)
                )
            `);

            // Create automod violations table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS automod_violations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    violation_type ENUM('spam', 'caps', 'links', 'invites', 'mentions', 'profanity') NOT NULL,
                    message_content TEXT,
                    channel_id VARCHAR(20),
                    action_taken ENUM('delete', 'warn', 'timeout', 'kick', 'ban') NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_violation_type (violation_type),
                    INDEX idx_timestamp (timestamp)
                )
            `);

            // Create timeouts table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS timeouts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    case_id VARCHAR(50) DEFAULT NULL,
                    username VARCHAR(100),
                    reason TEXT,
                    issued_by VARCHAR(20),
                    issued_by_name VARCHAR(100) DEFAULT NULL,
                    issued_by_source VARCHAR(20) DEFAULT NULL,
                    issued_at BIGINT,
                    expires_at BIGINT,
                    active BOOLEAN DEFAULT TRUE,
                    cleared_at BIGINT DEFAULT NULL,
                    cleared_by VARCHAR(20) DEFAULT NULL,
                    cleared_case_id VARCHAR(50) DEFAULT NULL,
                    cleared_reason TEXT,
                    INDEX idx_user (user_id),
                    INDEX idx_active (active),
                    INDEX idx_expires (expires_at)
                )
            `);

            // Add missing timeouts columns (migration)
            const timeoutColumnsToAdd = [
                { name: 'case_id', type: 'VARCHAR(50) DEFAULT NULL' },
                { name: 'issued_by_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'issued_by_source', type: 'VARCHAR(20) DEFAULT NULL' },
                { name: 'cleared_at', type: 'BIGINT DEFAULT NULL' },
                { name: 'cleared_by', type: 'VARCHAR(20) DEFAULT NULL' },
                { name: 'cleared_case_id', type: 'VARCHAR(50) DEFAULT NULL' },
                { name: 'cleared_reason', type: 'TEXT' }
            ];
            for (const col of timeoutColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE timeouts ADD COLUMN ${col.name} ${col.type}
                    `);
                    console.log(`✅ Added column '${col.name}' to timeouts table`);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name} to timeouts:`, err.message);
                    }
                }
            }

            // Create kicks table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS kicks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    case_id VARCHAR(50) DEFAULT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    username VARCHAR(100),
                    reason TEXT,
                    kicked_by VARCHAR(20),
                    kicked_by_name VARCHAR(100) DEFAULT NULL,
                    kicked_by_source VARCHAR(20) DEFAULT NULL,
                    kicked_at BIGINT,
                    INDEX idx_user (user_id),
                    INDEX idx_kicked_at (kicked_at)
                )
            `);

            // Add missing kicks columns (migration)
            const kicksColumnsToAdd = [
                { name: 'kicked_by_name', type: 'VARCHAR(100) DEFAULT NULL' },
                { name: 'kicked_by_source', type: 'VARCHAR(20) DEFAULT NULL' }
            ];
            for (const col of kicksColumnsToAdd) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE kicks ADD COLUMN ${col.name} ${col.type}
                    `);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, skip
                    } else {
                        console.error(`Error adding column ${col.name} to kicks:`, err.message);
                    }
                }
            }

            // Create polls table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS polls (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    message_id VARCHAR(20) UNIQUE NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    question TEXT NOT NULL,
                    options JSON NOT NULL,
                    ends_at TIMESTAMP NULL,
                    ended BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_message_id (message_id),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_ended (ended)
                )
            `);

            // Create member activity tracking table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS member_activity (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    username VARCHAR(100),
                    event_type ENUM('join', 'leave') NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_event_type (event_type),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_guild_id (guild_id)
                )
            `);

            // Create sessions table for express-session
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(128) PRIMARY KEY,
                    expires INT UNSIGNED NOT NULL,
                    data TEXT,
                    INDEX idx_expires (expires)
                )
            `);

            // Create invite codes table for admin registration
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS admin_invite_codes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(32) UNIQUE NOT NULL,
                    created_by VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NULL,
                    used_by VARCHAR(50) DEFAULT NULL,
                    used_at TIMESTAMP NULL DEFAULT NULL,
                    role ENUM('owner', 'admin', 'moderator') DEFAULT 'moderator',
                    active BOOLEAN DEFAULT TRUE,
                    INDEX idx_code (code),
                    INDEX idx_active (active),
                    INDEX idx_expires_at (expires_at)
                )
            `);

            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS user_interactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    username VARCHAR(32) DEFAULT NULL,
                    command_name VARCHAR(100) NOT NULL,
                    command_category VARCHAR(50) DEFAULT NULL,
                    guild_id VARCHAR(20) DEFAULT NULL,
                    channel_id VARCHAR(20) DEFAULT NULL,
                    status ENUM('SUCCESS', 'ERROR', 'RATE_LIMIT', 'PERMISSION') DEFAULT 'SUCCESS',
                    error_message TEXT DEFAULT NULL,
                    created_at BIGINT NOT NULL,
                    INDEX idx_user (user_id),
                    INDEX idx_command (command_name),
                    INDEX idx_created (created_at)
                )
            `);

            // Add status column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN status ENUM('SUCCESS', 'ERROR', 'RATE_LIMIT', 'PERMISSION') DEFAULT 'SUCCESS'
                `);
                console.log("✅ Added status column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding status column:", err.message);
                }
            }

            // Add error_message column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN error_message TEXT DEFAULT NULL
                `);
                console.log("✅ Added error_message column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding error_message column:", err.message);
                }
            }

            // Add command_name column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN command_name VARCHAR(100) NOT NULL DEFAULT ''
                `);
                console.log("✅ Added command_name column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding command_name column:", err.message);
                }
            }

            // Add command_category column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN command_category VARCHAR(50) DEFAULT NULL
                `);
                console.log("✅ Added command_category column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding command_category column:", err.message);
                }
            }

            // Add guild_id column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN guild_id VARCHAR(20) DEFAULT NULL
                `);
                console.log("✅ Added guild_id column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding guild_id column:", err.message);
                }
            }

            // Add channel_id column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN channel_id VARCHAR(20) DEFAULT NULL
                `);
                console.log("✅ Added channel_id column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding channel_id column:", err.message);
                }
            }

            // Add username column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN username VARCHAR(32) DEFAULT NULL
                `);
                console.log("✅ Added username column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding username column:", err.message);
                }
            }

            // Add created_at column if it doesn't exist
            try {
                await this.pool.execute(`
                    ALTER TABLE user_interactions ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0
                `);
                console.log("✅ Added created_at column to user_interactions table");
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, skip
                } else {
                    console.error("Error adding created_at column:", err.message);
                }
            }

            // Create ban appeals table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS ban_appeals (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    user_tag VARCHAR(100),
                    ban_case_id VARCHAR(20),
                    reason TEXT NOT NULL,
                    status ENUM('pending', 'accepted', 'denied') DEFAULT 'pending',
                    owner_response TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    decided_at TIMESTAMP NULL,
                    INDEX idx_user (user_id),
                    INDEX idx_status (status),
                    INDEX idx_ban_case_id (ban_case_id)
                )
            `);;
            console.log('✅ Ban Appeals table initialized');

            // Create alert settings table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS alert_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    alert_type ENUM('cpu', 'memory', 'error_rate', 'rate_limit', 'database') NOT NULL UNIQUE,
                    threshold FLOAT DEFAULT 80.0,
                    enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_type (alert_type)
                )
            `);
            console.log('✅ Alert Settings table initialized');

            // Create active alerts table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS active_alerts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    alert_type VARCHAR(50) NOT NULL,
                    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                    message TEXT NOT NULL,
                    value FLOAT,
                    threshold FLOAT,
                    resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP NULL,
                    INDEX idx_type (alert_type),
                    INDEX idx_resolved (resolved)
                )
            `);
            console.log('✅ Active Alerts table initialized');

            // Initialize default alert settings if they don't exist
            try {
                const [existing] = await this.pool.execute('SELECT COUNT(*) as count FROM alert_settings');
                if (existing[0].count === 0) {
                    await this.pool.execute(`
                        INSERT INTO alert_settings (alert_type, threshold, enabled) VALUES
                        ('cpu', 80.0, TRUE),
                        ('memory', 85.0, TRUE),
                        ('error_rate', 10.0, TRUE),
                        ('rate_limit', 75.0, TRUE),
                        ('database', 90.0, TRUE)
                    `);
                    console.log('✅ Initialized default alert settings');
                }
            } catch (err) {
                console.error("Error initializing alert settings:", err.message);
            }

            console.log('✅ MySQL Tables Initialized');
        } catch (error) {
            console.error('❌ Table Initialization Failed:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected || !this.pool) {
            throw new Error('MySQL not connected');
        }
        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            // Suppress known column errors as they're handled by catch blocks in callers
            if (!error.message || !error.message.includes('Unknown column')) {
                console.error('MySQL Query Error:', error.message);
            }
            throw error;
        }
    }

    async getConnection() {
        if (!this.isConnected || !this.pool) {
            throw new Error('MySQL not connected');
        }
        return await this.pool.getConnection();
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ MySQL Connection Closed');
        }
    }
}

// Export singleton instance
module.exports = new MySQLConnection();