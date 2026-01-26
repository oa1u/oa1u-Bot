const { EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * Create a consistent error embed
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {EmbedBuilder} Formatted error embed
 */
function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xF04747)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a consistent success embed
 * @param {string} title - Success title
 * @param {string} description - Success description
 * @returns {EmbedBuilder} Formatted success embed
 */
function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x43B581)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a consistent warning embed
 * @param {string} title - Warning title
 * @param {string} description - Warning description
 * @returns {EmbedBuilder} Formatted warning embed
 */
function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xFAA61A)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a consistent info embed
 * @param {string} title - Info title
 * @param {string} description - Info description
 * @returns {EmbedBuilder} Formatted info embed
 */
function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a moderation action embed with all relevant details
 * @param {Object} options - Options object
 * @returns {EmbedBuilder} Formatted moderation embed
 */
function createModerationEmbed(options = {}) {
    const {
        action = 'Action',
        target,
        moderator,
        reason = 'No reason provided',
        caseId,
        color = 0xFF0000
    } = options;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${action.toUpperCase()}`)
        .setTimestamp();

    if (target) {
        embed.addFields({
            name: '👤 Target',
            value: `${target.toString()} (${target.id})`,
            inline: true
        });
    }

    if (moderator) {
        embed.addFields({
            name: '⚔️ Moderator',
            value: `${moderator.toString()} (${moderator.id})`,
            inline: true
        });
    }

    embed.addFields({
        name: '📝 Reason',
        value: reason,
        inline: false
    });

    if (caseId) {
        embed.addFields({
            name: '📋 Case ID',
            value: caseId,
            inline: true
        });
    }

    return embed;
}

/**
 * Create a user profile embed
 * @param {User|GuildMember} user - User or member to display
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} Formatted profile embed
 */
function createUserEmbed(user, options = {}) {
    const {
        title = 'User Information',
        thumbnail = true,
        color = 0x5865F2
    } = options;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setTimestamp();

    const displayUser = user.user || user;
    const isGuildMember = !!user.guild;

    if (thumbnail) {
        embed.setThumbnail(displayUser.displayAvatarURL({ size: 256 }));
    }

    embed.addFields({
        name: '👤 Username',
        value: displayUser.username || displayUser.tag,
        inline: true
    });

    if (isGuildMember) {
        embed.addFields({
            name: '🏷️ Nickname',
            value: user.displayName || 'None',
            inline: true
        });
    }

    return embed;
}

/**
 * Send an error response with optional followUp option
 * @param {Interaction} interaction - Discord interaction
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {Promise<Message>} Sent message
 */
async function sendErrorReply(interaction, title, description) {
    const embed = createErrorEmbed(title, description);
    
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

/**
 * Send a success response
 * @param {Interaction} interaction - Discord interaction
 * @param {string} title - Success title
 * @param {string} description - Success description
 * @returns {Promise<Message>} Sent message
 */
async function sendSuccessReply(interaction, title, description) {
    const embed = createSuccessEmbed(title, description);
    
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

module.exports = {
    createErrorEmbed,
    createSuccessEmbed,
    createWarningEmbed,
    createInfoEmbed,
    createModerationEmbed,
    createUserEmbed,
    sendErrorReply,
    sendSuccessReply
};
