const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { AdminRole } = require('../../Config/constants/roles.json');
const giveawayHandler = require('../../Events/Giveaway');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Initiate a timed giveaway event with automatic winner selection in the giveaway channel')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration (examples: 10m, 1h, 2d) - Max 7 days')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('prize')
        .setDescription('The prize for the giveaway')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(100)
    ),
  category: 'management',
  async execute(interaction) {
    // Check if user has admin role
    if (!interaction.member.roles.cache.has(AdminRole)) {
      const embed = {
        color: 16711680,
        title: '🚫 Access Denied',
        description: `You do not have permission to use this command.\n\nOnly users with the <@&${AdminRole}> role can start giveaways.`,
        fields: [
          { name: '📋 Required Role', value: `<@&${AdminRole}>`, inline: false }
        ],
        footer: { text: 'Permission Required' },
        timestamp: new Date()
      };
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    await giveawayHandler.handleGiveaway(interaction, interaction.client);
  }
};