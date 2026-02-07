const { SlashCommandBuilder } = require('discord.js');
const { handlers } = require('./ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketmarkhandled')
    .setDescription('Mark this ticket as resolved'),
  category: 'ticket',
  async execute(interaction) {
    return handlers.markHandled(interaction);
  }
};