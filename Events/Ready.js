const { ActivityType } = require('discord.js');
const presenceConfig = require('../Config/presence.json');
const MySQLDatabaseManager = require('../Functions/MySQLDatabaseManager');
const { serverID } = require('../Config/main.json');

// This event triggers when the bot is fully online. It sets up the bot's presence and starts background tasks.
module.exports = {
    name: "clientReady",
    runOnce: true,
    call: async (client) => {
        console.log(`Ready! Logged in as ${client.user.username}`);
        
        updatePresence(client);
        
        // Rotates the bot's status every so often, so it looks lively.
        let currentIndex = 0;
        setInterval(() => {
            currentIndex = (currentIndex + 1) % presenceConfig.activities.length;
            updatePresence(client, currentIndex);
        }, presenceConfig.interval || 30000);

        // Kick off the cleanup for JoinToCreate channels.
        startJoinToCreateCleanup(client);
    }
};

// This function keeps Join-to-Create temp channels tidy by deleting empty ones.
async function startJoinToCreateCleanup(client) {
    const guild = client.guilds.cache.get(serverID);
    if (!guild) {
        console.warn('[Ready] Server not found for JTC cleanup');
        return;
    }

    console.log('[JTC] Starting cleanup interval...');
    
    // Every 10 seconds, check for empty temp channels and remove them.
    setInterval(async () => {
        try {
            // Grab all active JTC channels from the database.
            const jtcChannels = await MySQLDatabaseManager.getActiveJTCChannels(guild.id).catch(() => []);
            
            for (const jtcData of jtcChannels) {
                const vc = guild.channels.cache.get(jtcData.channel_id);
                
                if (!vc) {
                    // If the channel got deleted, clean up the database.
                    await MySQLDatabaseManager.deleteJTCChannel(jtcData.channel_id).catch(() => {});
                    continue;
                }
                
                if (vc.members.size < 1) {
                    // If nobody's in the channel anymore, delete it.
                    await MySQLDatabaseManager.deleteJTCChannel(vc.id).catch(() => {});
                    vc.delete().catch((err) => {
                        console.error(`[JTC] Couldn't delete temp channel: ${err.message}`);
                    });
                }
            }
            
            // Also delete really old channels (24+ hours) - don't run this every time though
            if (Math.random() < 0.0833) { // ~1 in 12 chance (runs every 2 mins on average)
                await MySQLDatabaseManager.cleanupOldJTCChannels(24 * 60 * 60 * 1000).catch(() => {});
            }
        } catch (err) {
            console.error('[JTC] Cleanup error:', err.message);
        }
    }, 10000);
}

function updatePresence(client, index = 0) {
    try {
        const activity = presenceConfig.activities[index];
        if (!activity) return;
        
        let activityName = activity.name
            .replace('{servers}', client.guilds.cache.size)
            .replace('{members}', client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))
            .replace('{users}', client.users.cache.size)
            .replace('{channels}', client.channels.cache.size);
        
        const activityTypes = {
            0: ActivityType.Playing,
            1: ActivityType.Streaming,
            2: ActivityType.Listening,
            3: ActivityType.Watching,
            5: ActivityType.Competing
        };
        
        client.user.setPresence({
            activities: [{
                name: activityName,
                type: activityTypes[activity.type] || ActivityType.Playing
            }],
            status: activity.status || presenceConfig.defaultStatus || 'online'
        });
    } catch (error) {
        console.error('Error updating presence:', error);
    }
}