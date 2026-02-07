const moment = require("moment");
require("moment-duration-format");
const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { generateCaseId } = require("../../Events/caseId");
const { sendErrorReply, sendSuccessReply, createModerationEmbed } = require("../../Functions/EmbedBuilders");
const { canModerateMember, addCase, sendModerationDM, logModerationAction } = require("../../Functions/ModerationHelper");
const DatabaseManager = require('../../Functions/MySQLDatabaseManager');

// Warns a user and keeps track in the database
// Too many warnings can trigger auto-punishments
module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    ),
  category: 'moderation',
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const targetUser = interaction.options.getUser('user');
    const reasonInput = interaction.options.getString('reason');
    
    // The reason could be a preset or something custom
    const reason = DatabaseManager.getResolvedReason(reasonInput);

    if (!await canModerateMember(interaction, targetUser, 'warn')) {
      return;
    }

    // Make sure the user is still in the server (can't warn someone who left)
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await sendErrorReply(
        interaction,
        'Invalid User',
        `**${targetUser.tag}** is not in this server!`
      );
      return;
    }

    // Make a new case ID for this warning
    const caseID = generateCaseId('WARN');

    // Put together the log message for this warning
    const logEmbed = createModerationEmbed({
      action: '⚠️ Warn',
      target: targetUser,
      moderator: interaction.user,
      reason: reason,
      caseId: caseID,
      color: 0xFAA61A
    });

    // DM the user
    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Server Warning Notice')
      .setColor(0xFAA61A)
      .setDescription(`You have received an official warning in **${interaction.guild.name}** for your actions.`)
      .addFields(
        { name: 'Warning Type', value: '**Server Conduct Violation**', inline: true },
        { name: 'Issued At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: 'Violation Details', value: `\`\`\`${reason}\`\`\``, inline: false },
        { name: 'Case ID', value: `\`${caseID}\``, inline: true },
        { name: 'Issued By', value: `\`${interaction.user.tag}\``, inline: true },
        { name: 'Next Steps', value: 'Repeated violations may result in further moderation action. Please review our server rules and code of conduct.', inline: false }
      )
      .setFooter({ text: `${interaction.guild.name} • Moderation System` })
      .setTimestamp();

    const dmSent = await sendModerationDM(targetUser, dmEmbed);

    // Log this action in the mod log channel
    await logModerationAction(interaction, logEmbed);

    // Count warnings BEFORE saving (to get the accurate count for notification)
    const previousWarns = await DatabaseManager.getUserWarnsCount(targetUser.id);
    const totalWarns = previousWarns + 1;

    // Save the warning to database
    addCase(targetUser.id, caseID, {
      moderator: interaction.user.id,
      moderatorTag: interaction.user.username,
      userTag: targetUser.username,
      reason: reason,
      date: moment(Date.now()).format('LL'),
      type: 'WARN'
    });

    await sendSuccessReply(
      interaction,
      'Warning Issued',
      `Warned **${targetUser.tag}**\n` +
      `Case: \`${caseID}\`\n` +
      `Total: **${totalWarns}**\n` +
      `DM: ${dmSent ? '✅' : '❌'}`
    );
  }
};