// Bot statistics shared between the bot and admin panel.
// Stats are saved to a JSON file so both can access them.
// Tracks things like command usage, message counts, and more.
const fs = require('fs');
const path = require('path');
const statsFile = path.join(__dirname, '../Config/botStats.json');

function readStatsFile() {
    try {
        if (fs.existsSync(statsFile)) {
            const raw = fs.readFileSync(statsFile, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        // fallback to defaults
    }
    return {
        uptime: 0,
        guildCount: 0,
        totalMembers: 0,
        botMembers: 0,
        totalRoles: 0,
        totalChannels: 0,
        commandsLoaded: 0,
        eventsLoaded: 0,
        lastUpdated: new Date().toISOString()
    };
}

function writeStatsFile(stats) {
    try {
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    } catch (e) {
        // ignore
    }
}

function updateStats(stats) {
    const current = readStatsFile();
    const updated = {
        ...current,
        ...stats,
        lastUpdated: new Date().toISOString()
    };
    writeStatsFile(updated);
}

function getStats() {
    return readStatsFile();
}

module.exports = { updateStats, getStats };