const { MessageFlags } = require('discord.js');
const { isModOrAdmin, getMemberFromMention } = require('./GetMemberFromMention');
const { createErrorEmbed, sendErrorReply } = require('./EmbedBuilders');
const DatabaseManager = require('./DatabaseManager');

/**
 * Check if the executor has permission to moderate a target
 * @param {Interaction} interaction - The Discord interaction
 * @param {User} targetUser - The user being targeted
 * @param {string} actionName - Name of the action (ban, kick, warn)
 * @returns {Promise<boolean>} True if allowed, false otherwise
 */
async function canModerateMember(interaction, targetUser, actionName = 'action') {
    const executor = interaction.member;
    const guild = interaction.guild;

    // Check if executor is mod/admin
    if (!isModOrAdmin(executor)) {
        await sendErrorReply(
            interaction,
            'No Permission',
            `You need mod permissions to ${actionName} members!`
        );
        return false;
    }

    // Check if targeting self
    if (executor.id === targetUser.id) {
        await sendErrorReply(
            interaction,
            'Error',
            `You cannot ${actionName} yourself!`
        );
        return false;
    }

    // Fetch target member and check role hierarchy
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember && executor.roles.highest.position <= targetMember.roles.highest.position) {
        await sendErrorReply(
            interaction,
            'Role Hierarchy',
            `You cannot ${actionName} that user due to role hierarchy!`
        );
        return false;
    }

    return true;
}

/**
 * Get or create warn database entry for a user
 * @param {string} userId - The user ID
 * @returns {Object} User's warn data
 */
function getOrCreateWarnEntry(userId) {
    return DatabaseManager.getUserWarns(userId);
}

/**
 * Add a moderation case to a user's record
 * @param {string} userId - The user ID
 * @param {string} caseId - The case ID
 * @param {Object} caseData - Case information
 */
function addCase(userId, caseId, caseData) {
    DatabaseManager.addCase(userId, caseId, caseData);
}

/**
 * Send DM to user
 * @param {User} user - The user to DM
 * @param {EmbedBuilder} embed - The embed to send
 * @returns {Promise<boolean>} True if sent, false otherwise
 */
async function sendModerationDM(user, embed) {
    try {
        await user.send({ embeds: [embed] });
        return true;
    } catch (err) {
        console.warn(`Could not send DM to ${user.tag}: ${err.message}`);
        return false;
    }
}

/**
 * Log moderation action to logging channel
 * @param {Interaction} interaction - The Discord interaction
 * @param {EmbedBuilder} embed - The embed to log
 * @returns {Promise<boolean>} True if sent, false otherwise
 */
async function logModerationAction(interaction, embed) {
    const { channelLog } = require('../Config/constants/channel.json');
    const loggingChannel = interaction.guild.channels.cache.get(channelLog);

    if (!loggingChannel) {
        console.warn('Logging channel not found or not configured');
        return false;
    }

    try {
        await loggingChannel.send({ embeds: [embed] });
        return true;
    } catch (err) {
        console.error(`Error logging action: ${err.message}`);
        return false;
    }
}

/**
 * Validate and resolve a user input (mention, ID, or username)
 * @param {Interaction} interaction - The Discord interaction
 * @param {string|User} input - User input or User object
 * @returns {Promise<User|null>} The resolved user or null
 */
async function resolveUser(interaction, input) {
    // If already a User object, return it
    if (input && typeof input === 'object' && input.id) {
        return input;
    }

    // Try getting from mention/string input
    if (typeof input === 'string') {
        const user = await getMemberFromMention(interaction.guild, input)
            .then(m => m?.user || null)
            .catch(() => null);
        if (user) return user;
    }

    return null;
}

module.exports = {
    canModerateMember,
    getOrCreateWarnEntry,
    addCase,
    sendModerationDM,
    logModerationAction,
    resolveUser
};
