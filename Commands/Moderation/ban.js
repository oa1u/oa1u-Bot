const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const moment = require("moment");
require("moment-duration-format");
const { generateCaseId } = require("../../Events/caseId");
const { sendErrorReply, sendSuccessReply, createModerationEmbed } = require("../../Functions/EmbedBuilders");
const { canModerateMember, addCase, sendModerationDM, logModerationAction } = require("../../Functions/ModerationHelper");
const { AppealLink } = require("../../Config/main.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a user from the server with an optional reason')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),
  category: 'moderation',
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Check permissions and hierarchy
    if (!await canModerateMember(interaction, targetUser, 'ban')) {
      return;
    }

    // Generate case ID
    const caseID = generateCaseId('BAN');

    // Create logging embed
    const logEmbed = createModerationEmbed({
      action: '🔨 BAN',
      target: targetUser,
      moderator: interaction.user,
      reason: reason,
      caseId: caseID,
      color: 0xF04747
    });

    // Send DM to user
    const dmEmbed = new EmbedBuilder()
      .setTitle('🔨 You Have Been Banned')
      .setColor(0xF04747)
      .setDescription(`You were banned from **${interaction.guild.name}**`)
      .addFields(
        { name: '📝 Reason', value: reason, inline: false },
        { name: '🔑 Case ID', value: `\`${caseID}\``, inline: true },
        { name: '📬 Ban Appeal', value: `[How to Appeal](${AppealLink})`, inline: true }
      )
      .setTimestamp();

    const dmSent = await sendModerationDM(targetUser, dmEmbed);

    // Log the action
    await logModerationAction(interaction, logEmbed);

    // Add to database
    addCase(targetUser.id, caseID, {
      moderator: interaction.user.id,
      reason: `(banned) - ${reason}`,
      date: moment(Date.now()).format('LL'),
      type: 'BAN'
    });

    // Perform the ban
    try {
      await interaction.guild.members.ban(targetUser, { reason });
      
      // Send success response
      await sendSuccessReply(
        interaction,
        'Member Banned',
        `Successfully banned **${targetUser.tag}**\n` +
        `Case ID: \`${caseID}\`\n` +
        `DM Sent: ${dmSent ? '✅' : '❌'}`
      );
    } catch (err) {
      console.error(`Error banning ${targetUser.tag}:`, err.message);
      await sendErrorReply(
        interaction,
        'Ban Failed',
        `Could not ban **${targetUser.tag}**\nError: ${err.message}`
      );
    }
  }
};