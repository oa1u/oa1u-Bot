const { isModOrAdmin, getMemberFromMention } = require('./GetMemberFromMention');
const { sendErrorReply } = require('./EmbedBuilders');
const DatabaseManager = require('./MySQLDatabaseManager');
const { getMember, getUser } = require('./Helpers');

// Helper functions for moderation commands.
// Checks permissions, logs actions, and sends DM notifications for mod actions.
// Helps keep moderation commands clean and simple.

// Checks if the person running the command can moderate the target user.
async function canModerateMember(interaction, targetUser, actionName = 'action') {
    const executor = interaction.member;
    const guild = interaction.guild;

    if (!isModOrAdmin(executor)) {
        await sendErrorReply(
            interaction,
            'No Permission',
            `You need mod permissions to ${actionName} members!`
        );
        return false;
    }

    if (executor.id === targetUser.id) {
        await sendErrorReply(
            interaction,
            'Error',
            `You cannot ${actionName} yourself!`
        );
        return false;
    }

    // Make sure you can't moderate someone with a higher role than you.
    const targetMember = await getMember(guild, targetUser.id);
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

function getOrCreateWarnEntry(userId) {
    return DatabaseManager.getUserWarns(userId);
}

function addCase(userId, caseId, caseData) {
    DatabaseManager.addCase(userId, caseId, caseData);
}

// Tries to send a DM to a user. Doesn't always work if their DMs are off.
async function sendModerationDM(user, embed) {
    try {
        // If it's a user object, just send it
        if (user && typeof user.send === 'function') {
            await user.send({ embeds: [embed] }).catch(dmErr => {
                throw new Error(`DM send failed: ${dmErr.message}`);
            });
            return true;
        }
        
        // Try to DM them directly if they have an ID
        if (user && user.id) {
            try {
                await user.send({ embeds: [embed] });
                return true;
            } catch (dmErr) {
                console.warn(`Could not send DM to ${user.tag || user.id}: ${dmErr.message}`);
                return false;
            }
        }
        
        console.warn(`Invalid user object for DM: ${user?.id || 'unknown'}`);
        return false;
    } catch (err) {
        console.warn(`DM operation failed for ${user?.tag || user?.id || 'unknown'}: ${err.message}`);
        return false;
    }
}

// Log moderation action to the server log channel
async function logModerationAction(interaction, embed) {
    const { serverLogChannelId } = require('../Config/constants/channel.json');
    const loggingChannel = interaction.guild.channels.cache.get(serverLogChannelId);

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

// Resolve user from mention, ID, or username
async function resolveUser(interaction, input) {
    // Already a User object
    if (input && typeof input === 'object' && input.id) {
        return input;
    }

    // Try getting from mention/string input
    if (typeof input === 'string') {
        try {
            const user = await getMemberFromMention(interaction.guild, input)
                .then(m => m?.user || null)
                .catch(err => {
                    console.warn(`[ModerationHelper] Could not resolve user from input '${input}': ${err.message}`);
                    return null;
                });
            if (user) return user;
        } catch (err) {
            console.error(`[ModerationHelper] Error in resolveUser: ${err.message}`);
        }
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