const { EmbedBuilder } = require('discord.js');
const JSONDatabase = require('../Functions/Database');
const { levelup } = require('../Config/constants/channel.json');
const { config: CONFIG, multipliers: MULTIPLIERS, levelRoles: LEVEL_ROLES } = require('../Config/constants/leveling.json');

// Initialize leveling database
const levelDB = new JSONDatabase('levels', { writeInterval: 2000 });

// Cooldown tracker
const cooldowns = new Map();

/**
 * Calculate XP required for a specific level
 */
function calculateRequiredXP(level) {
    return Math.floor(CONFIG.baseRequirement * Math.pow(CONFIG.levelMultiplier, level - 1));
}

/**
 * Calculate level from total XP
 */
function calculateLevel(xp) {
    let level = 1;
    let totalRequired = 0;
    
    while (totalRequired <= xp) {
        totalRequired += calculateRequiredXP(level);
        if (totalRequired > xp) break;
        level++;
    }
    
    return level - 1;
}

/**
 * Get user leveling data
 */
function getUserData(userId) {
    return levelDB.ensure(userId, {
        xp: 0,
        level: 1,
        totalXP: 0,
        messages: 0,
        lastXPGain: 0,
    });
}

/**
 * Calculate XP gain based on message content
 */
function calculateXPGain(message) {
    let xp = CONFIG.baseXP + Math.floor(Math.random() * CONFIG.randomXP);
    
    // Apply multipliers
    if (message.content.length > 100) {
        xp *= MULTIPLIERS.longMessage;
    }
    
    if (message.attachments.size > 0) {
        xp *= MULTIPLIERS.hasImage;
    }
    
    if (message.content.match(/https?:\/\//)) {
        xp *= MULTIPLIERS.hasLink;
    }
    
    return Math.floor(xp);
}

/**
 * Send level up notification
 */
async function sendLevelUpNotification(message, userData, newLevel) {
    const levelUpEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 Level Up!')
        .setDescription(`${message.author} just advanced to **Level ${newLevel}**!`)
        .addFields(
            { name: '📊 Total XP', value: `${userData.totalXP.toLocaleString()}`, inline: true },
            { name: '💬 Messages', value: `${userData.messages.toLocaleString()}`, inline: true },
            { name: '⬆️ Next Level', value: `${calculateRequiredXP(newLevel + 1)} XP`, inline: true }
        )
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
        .setTimestamp()
        .setFooter({ text: `Keep chatting to level up!` });

    // Check for level role rewards
    if (LEVEL_ROLES[`role${newLevel}`]) {
        const role = message.guild.roles.cache.get(LEVEL_ROLES[`role${newLevel}`]);
        if (role) {
            try {
                await message.member.roles.add(role);
                levelUpEmbed.addFields({
                    name: '🎁 Reward Unlocked',
                    value: `You earned the ${role} role!`,
                    inline: false
                });
            } catch (err) {
                console.error(`Failed to assign level role: ${err.message}`);
            }
        }
    }

    // Send to channel or DM
    try {
        await message.reply({ embeds: [levelUpEmbed] });
    } catch {
        // If can't reply, try sending in channel
        try {
            await message.channel.send({ embeds: [levelUpEmbed] });
        } catch (err) {
            console.error(`Failed to send level up message: ${err.message}`);
        }
    }

    // Log to moderation channel
    const logChannel = message.guild.channels.cache.get(levelup);
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('📈 Member Leveled Up')
            .addFields(
                { name: '👤 User', value: `${message.author.tag}\n\`${message.author.id}\``, inline: true },
                { name: '⬆️ New Level', value: `${newLevel}`, inline: true },
                { name: '📊 Total XP', value: `${userData.totalXP.toLocaleString()}`, inline: true }
            )
            .setTimestamp();
        
        logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
}

/**
 * Process XP gain for a message
 */
async function processXP(message) {
    // Ignore bots
    if (message.author.bot) return;
    
    // Ignore DMs
    if (!message.guild) return;
    
    // Check cooldown
    const now = Date.now();
    const cooldownKey = `${message.author.id}_${message.guild.id}`;
    
    if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey) + CONFIG.cooldown;
        if (now < expirationTime) return;
    }
    
    // Set new cooldown
    cooldowns.set(cooldownKey, now);
    
    // Clean up old cooldowns periodically
    setTimeout(() => cooldowns.delete(cooldownKey), CONFIG.cooldown);
    
    // Get user data
    const userData = getUserData(message.author.id);
    const oldLevel = userData.level;
    
    // Calculate and add XP
    const xpGain = calculateXPGain(message);
    userData.xp += xpGain;
    userData.totalXP += xpGain;
    userData.messages += 1;
    userData.lastXPGain = now;
    
    // Check for level up
    let newLevel = oldLevel;
    while (userData.xp >= calculateRequiredXP(newLevel + 1)) {
        userData.xp -= calculateRequiredXP(newLevel + 1);
        newLevel++;
    }
    
    userData.level = newLevel;
    
    // Save to database
    levelDB.set(message.author.id, userData);
    
    // Send level up notification if leveled up
    if (newLevel > oldLevel) {
        await sendLevelUpNotification(message, userData, newLevel);
    }
}

/**
 * Get leaderboard data
 */
function getLeaderboard(limit = 10) {
    const allUsers = levelDB.all();
    const sorted = Object.entries(allUsers)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalXP - a.totalXP)
        .slice(0, limit);
    
    return sorted;
}

/**
 * Get user rank
 */
function getUserRank(userId) {
    const allUsers = levelDB.all();
    const sorted = Object.entries(allUsers)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalXP - a.totalXP);
    
    const rank = sorted.findIndex(u => u.id === userId) + 1;
    return rank || null;
}

/**
 * Set user XP (admin function)
 */
function setUserXP(userId, xp) {
    const userData = getUserData(userId);
    userData.totalXP = xp;
    userData.xp = 0;
    userData.level = calculateLevel(xp);
    
    // Recalculate current level XP
    let totalRequired = 0;
    for (let i = 1; i < userData.level; i++) {
        totalRequired += calculateRequiredXP(i);
    }
    userData.xp = xp - totalRequired;
    
    levelDB.set(userId, userData);
    return userData;
}

/**
 * Reset user levels (admin function)
 */
function resetUser(userId) {
    levelDB.delete(userId);
    return true;
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        await processXP(message);
    },
    // Export utility functions for commands
    getUserData,
    getLeaderboard,
    getUserRank,
    calculateRequiredXP,
    setUserXP,
    resetUser,
    CONFIG,
};