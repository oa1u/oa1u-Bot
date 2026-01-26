const moment = require("moment");
require("moment-duration-format");
const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { generateCaseId } = require("../../Events/caseId");
const { sendErrorReply, sendSuccessReply, createModerationEmbed } = require("../../Functions/EmbedBuilders");
const { canModerateMember, addCase, sendModerationDM, logModerationAction } = require("../../Functions/ModerationHelper");
const DatabaseManager = require('../../Functions/DatabaseManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from the server with a specified reason')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(true)
    ),
  category: 'moderation',
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reasonInput = interaction.options.getString('reason');
    
    // Check for canned messages
    const reason = DatabaseManager.getResolvedReason(reasonInput);

    // Check permissions and hierarchy
    if (!await canModerateMember(interaction, targetUser, 'kick')) {
      return;
    }

    // Fetch member to verify they exist in guild
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await sendErrorReply(
        interaction,
        'Invalid User',
        `**${targetUser.tag}** is not in this server!`
      );
      return;
    }

    // Generate case ID
    const caseID = generateCaseId('KICK');

    // Create logging embed
    const logEmbed = createModerationEmbed({
      action: '👢 KICK',
      target: targetUser,
      moderator: interaction.user,
      reason: reason,
      caseId: caseID,
      color: 0xFAA61A
    });

    // Send DM to user
    const dmEmbed = new EmbedBuilder()
      .setTitle('👢 You Have Been Kicked')
      .setColor(0xFAA61A)
      .setDescription(`You were kicked from **${interaction.guild.name}**`)
      .addFields(
        { name: '📝 Reason', value: reason, inline: false },
        { name: '🔑 Case ID', value: `\`${caseID}\``, inline: true },
        { name: '⚡ Note', value: 'Please avoid repeating this behavior!', inline: true }
      )
      .setTimestamp();

    const dmSent = await sendModerationDM(targetUser, dmEmbed);

    // Log the action
    await logModerationAction(interaction, logEmbed);

    // Add to database
    addCase(targetUser.id, caseID, {
      moderator: interaction.user.id,
      reason: `(kicked) - ${reason}`,
      date: moment(Date.now()).format('LL'),
      type: 'KICK'
    });

    // Perform the kick
    try {
      await targetMember.kick(reason);
      
      // Send success response
      await sendSuccessReply(
        interaction,
        'Member Kicked',
        `Successfully kicked **${targetUser.tag}**\n` +
        `Case ID: \`${caseID}\`\n` +
        `DM Sent: ${dmSent ? '✅' : '❌'}`
      );
    } catch (err) {
      console.error(`Error kicking ${targetUser.tag}:`, err.message);
      await sendErrorReply(
        interaction,
        'Kick Failed',
        `Could not kick **${targetUser.tag}**\nError: ${err.message}`
      );
    }
  }
};