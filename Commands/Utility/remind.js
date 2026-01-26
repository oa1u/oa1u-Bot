const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const DatabaseManager = require('../../Functions/DatabaseManager');
const moment = require('moment');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Schedule a personal reminder to be delivered via direct message at a specified time')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What to remind you about')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('Minutes until reminder (1-1440)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440)
    ),
  category: 'utility',
  async execute(interaction) {
    const remindDB = DatabaseManager.getRemindersDB();
    const message = interaction.options.getString('message');
    const minutes = interaction.options.getInteger('minutes');
    
    // Create reminder object
    const reminderId = `${interaction.user.id}-${Date.now()}`;
    const reminderData = {
      userId: interaction.user.id,
      message: message,
      createdAt: Date.now(),
      triggerAt: Date.now() + (minutes * 60000),
      channelId: interaction.channelId,
      guildId: interaction.guildId
    };
    
    remindDB.set(reminderId, reminderData);
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x43B581)
      .setTitle('✅ Reminder Set')
      .addFields(
        { name: '💬 Message', value: message, inline: false },
        { name: '⏰ Time', value: `${minutes} minute${minutes !== 1 ? 's' : ''}`, inline: true },
        { name: '🕐 Will remind at', value: moment(Date.now() + (minutes * 60000)).format('HH:mm:ss'), inline: true }
      )
      .setFooter({ text: `Reminder ID: ${reminderId}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    // Set timeout for reminder
    setTimeout(async () => {
      try {
        const user = await interaction.client.users.fetch(interaction.user.id);
        const reminderEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🔔 Reminder!')
          .setDescription(message)
          .setTimestamp();
        
        await user.send({ embeds: [reminderEmbed] });
      } catch (error) {
        console.log('Could not send reminder DM to user');
      }
      
      // Clean up from database
      remindDB.delete(reminderId);
    }, minutes * 60000);
  }
};