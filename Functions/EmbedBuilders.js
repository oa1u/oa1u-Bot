const { EmbedBuilder, MessageFlags } = require('discord.js');

// Functions for building embeds so all bot messages look consistent.
// Keeps all embeds uniform across the bot.
// TODO: Add more embed templates (info, warning, etc.).

// Basic embed creators for error, success, warning, and info messages.
function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xF04747)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setFooter({ text: 'Error occurred • Action not completed' })
        .setTimestamp();
}

function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x43B581)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setFooter({ text: 'Success • Action completed' })
        .setTimestamp();
}

function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xFAA61A)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setFooter({ text: 'Warning • Please review' })
        .setTimestamp();
}

function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setFooter({ text: 'Information • For your reference' })
        .setTimestamp();
}

// Builds fancy embeds for moderation actions like bans, kicks, warns, etc.
function createModerationEmbed(options = {}) {
    const {
        action = 'Action',
        target,
        moderator,
        reason = 'No reason provided',
        caseId,
        duration = null,
        color = 0xFF0000
    } = options;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`⚖️ ${action.toUpperCase()}`)
        .setDescription(`A moderation action has been taken against a member.`)
        .setTimestamp();

    if (target) {
        embed.addFields({
            name: '👤 Target User',
            value: `${target.toString()}\n\`ID: ${target.id}\``,
            inline: true
        });
    }

    if (moderator) {
        embed.addFields({
            name: '👮 Moderator',
            value: `${moderator.toString()}\n\`ID: ${moderator.id}\``,
            inline: true
        });
    }

    embed.addFields({
        name: '📝 Reason',
        value: `\`\`\`${reason}\`\`\``,
        inline: false
    });

    if (caseId) {
        embed.addFields({
            name: '📋 Case ID',
            value: caseId,
            inline: true
        });
    }

    if (duration) {
        embed.addFields({
            name: '⏰ Duration',
            value: duration,
            inline: true
        });
    }

    embed.setFooter({ text: 'Moderation • Action logged' });

    return embed;
}

// Create a nice-looking user profile embed
function createUserEmbed(user, options = {}) {
    const {
        title = 'User Profile',
        thumbnail = true,
        color = 0x5865F2
    } = options;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`👤 ${title}`)
        .setDescription(`Detailed information about this user.`)
        .setTimestamp();

    const displayUser = user.user || user;
    const isGuildMember = !!user.guild; // Check if it's a guild member object

    if (thumbnail) {
        embed.setThumbnail(displayUser.displayAvatarURL({ size: 256 }));
    }

    embed.addFields({
        name: 'Username',
        value: `\`${displayUser.username || displayUser.tag}\``,
        inline: true
    });

    if (isGuildMember) {
        embed.addFields({
            name: 'Server Nickname',
            value: user.displayName || 'Not set',
            inline: true
        });
    }

    if (displayUser.id) {
        embed.addFields({
            name: 'User ID',
            value: `\`${displayUser.id}\``,
            inline: true
        });
    }

    embed.setFooter({ text: 'User Information System' });

    return embed;
}

// Send error reply
async function sendErrorReply(interaction, title, description) {
    const embed = createErrorEmbed(title, description);
    
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

// Send success reply
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