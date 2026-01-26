const JSONDatabase = require('./Database');

/**
 * Database Manager - Centralized cache for all database instances
 * Prevents creating duplicate instances and optimizes write operations
 */
class DatabaseManager {
    constructor() {
        this.databases = new Map();
        this.pendingWrites = new Map();
        this.writeDelay = 500; // Batch writes every 500ms
    }

    /**
     * Get or create a database instance (cached)
     * @param {string} name - Database name
     * @returns {JSONDatabase} Database instance
     */
    getDatabase(name) {
        if (!this.databases.has(name)) {
            this.databases.set(name, new JSONDatabase(name));
        }
        return this.databases.get(name);
    }

    /**
     * Queue a database operation for batching
     * @param {string} dbName - Database name
     * @param {Function} operation - Function that performs the database operation
     * @returns {Promise} Resolves when operation is queued
     */
    async queueOperation(dbName, operation) {
        if (!this.pendingWrites.has(dbName)) {
            this.pendingWrites.set(dbName, []);
            
            // Schedule batch write
            setTimeout(() => {
                const operations = this.pendingWrites.get(dbName) || [];
                if (operations.length > 0) {
                    const db = this.getDatabase(dbName);
                    operations.forEach(op => op(db));
                    this.pendingWrites.delete(dbName);
                }
            }, this.writeDelay);
        }
        
        this.pendingWrites.get(dbName).push(operation);
    }

    /**
     * Get warns database
     * @returns {JSONDatabase} Warns database
     */
    getWarnsDB() {
        return this.getDatabase('warns');
    }

    /**
     * Get canned messages database
     * @returns {JSONDatabase} Canned messages database
     */
    getCannedMsgsDB() {
        return this.getDatabase('cannedMsgs');
    }

    /**
     * Get reminders database
     * @returns {JSONDatabase} Reminders database
     */
    getRemindersDB() {
        return this.getDatabase('reminders');
    }

    /**
     * Add or update a case in warns database
     * @param {string} userId - User ID
     * @param {string} caseId - Case ID
     * @param {Object} caseData - Case data
     */
    addCase(userId, caseId, caseData) {
        const warnsDB = this.getWarnsDB();
        const userData = warnsDB.ensure(userId, { warns: {} });
        userData.warns[caseId] = caseData;
        userData.lastWarned = new Date().toISOString();
        warnsDB.set(userId, userData);
    }

    /**
     * Get user warns
     * @param {string} userId - User ID
     * @returns {Object} User warns data
     */
    getUserWarns(userId) {
        const warnsDB = this.getWarnsDB();
        return warnsDB.ensure(userId, { warns: {} });
    }

    /**
     * Get all warns for a user (count)
     * @param {string} userId - User ID
     * @returns {number} Total warns count
     */
    getUserWarnsCount(userId) {
        const userData = this.getUserWarns(userId);
        return Object.keys(userData.warns || {}).length;
    }

    /**
     * Clear warns for a user
     * @param {string} userId - User ID
     */
    clearUserWarns(userId) {
        const warnsDB = this.getWarnsDB();
        warnsDB.set(userId, { warns: {} });
    }

    /**
     * Check if user is banned (in warns database)
     * @param {string} userId - User ID
     * @returns {boolean} True if user is marked as banned
     */
    isUserBanned(userId) {
        const warnsDB = this.getWarnsDB();
        const userData = warnsDB.get(userId) || {};
        return userData.banned === true;
    }

    /**
     * Mark user as banned
     * @param {string} userId - User ID
     */
    markUserBanned(userId) {
        const warnsDB = this.getWarnsDB();
        const userData = warnsDB.ensure(userId, { warns: {} });
        userData.banned = true;
        warnsDB.set(userId, userData);
    }

    /**
     * Mark user as unbanned
     * @param {string} userId - User ID
     */
    unbanUser(userId) {
        const warnsDB = this.getWarnsDB();
        const userData = warnsDB.ensure(userId, { warns: {} });
        userData.banned = false;
        warnsDB.set(userId, userData);
    }

    /**
     * Get canned message
     * @param {string} alias - Message alias
     * @returns {string|null} Canned message or null
     */
    getCannedMessage(alias) {
        const cannedDB = this.getCannedMsgsDB();
        return cannedDB.has(alias) ? cannedDB.get(alias) : null;
    }

    /**
     * Get resolved reason (canned or original)
     * @param {string} reasonInput - Reason input
     * @returns {string} Resolved reason
     */
    getResolvedReason(reasonInput) {
        const canned = this.getCannedMessage(reasonInput);
        return canned || reasonInput;
    }

    /**
     * Add reminder
     * @param {string} userId - User ID
     * @param {Object} reminderData - Reminder data
     * @returns {string} Reminder ID
     */
    addReminder(userId, reminderData) {
        const remindersDB = this.getRemindersDB();
        const reminderId = `${userId}-${Date.now()}`;
        const userReminders = remindersDB.ensure(userId, []);
        userReminders.push({ id: reminderId, ...reminderData });
        remindersDB.set(userId, userReminders);
        return reminderId;
    }

    /**
     * Get user reminders
     * @param {string} userId - User ID
     * @returns {Array} User reminders
     */
    getUserReminders(userId) {
        const remindersDB = this.getRemindersDB();
        return remindersDB.ensure(userId, []);
    }

    /**
     * Remove reminder
     * @param {string} userId - User ID
     * @param {string} reminderId - Reminder ID
     */
    removeReminder(userId, reminderId) {
        const remindersDB = this.getRemindersDB();
        const userReminders = remindersDB.ensure(userId, []);
        const filtered = userReminders.filter(r => r.id !== reminderId);
        remindersDB.set(userId, filtered);
    }

    /**
     * Get all databases info for debugging
     * @returns {Object} Database stats
     */
    getStats() {
        const stats = {};
        this.databases.forEach((db, name) => {
            stats[name] = {
                size: db.size(),
                entries: db.size(),
                filePath: db.filePath
            };
        });
        return stats;
    }

    /**
     * Clear all cached instances (for testing)
     */
    clearCache() {
        this.databases.clear();
        this.pendingWrites.clear();
    }
}

// Export singleton instance
module.exports = new DatabaseManager();