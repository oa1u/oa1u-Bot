const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { sendErrorReply, sendSuccessReply, createModerationEmbed } = require("../../Functions/EmbedBuilders");
const { logModerationAction } = require("../../Functions/ModerationHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear a certain amount of messages from the channel')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this specific user')
        .setRequired(false)
    ),
  category: "moderation",
  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await sendErrorReply(
        interaction,
        'No Permission',
        'You need the **Manage Messages** permission to use this command!'
      );
      return;
    }

    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    try {
      // Fetch messages
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      
      // Filter by user if specified
      const toDelete = targetUser 
        ? messages.filter(msg => msg.author.id === targetUser.id)
        : messages;

      // Bulk delete
      const deleted = await interaction.channel.bulkDelete(toDelete, true);

      // Create logging embed
      const logEmbed = createModerationEmbed({
        action: '🧹 Clear',
        target: targetUser || interaction.channel,
        moderator: interaction.user,
        reason: targetUser 
          ? `Cleared ${deleted.size} message(s) from ${targetUser.tag}`
          : `Cleared ${deleted.size} message(s)`,
        color: 0x43B581
      });

      // Log the action
      await logModerationAction(interaction, logEmbed);

      // Send success response
      await sendSuccessReply(
        interaction,
        'Messages Cleared',
        `Successfully deleted **${deleted.size}** message(s)${targetUser ? ` from **${targetUser.tag}**` : ''}`
      );
    } catch (err) {
      console.error(`Error clearing messages:`, err.message);
      await sendErrorReply(
        interaction,
        'Clear Failed',
        `Could not clear messages\nError: ${err.message}`
      );
    }
  }
};