const { SlashCommandBuilder } = require('discord.js');
const { handlers } = require('./ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketclose')
    .setDescription('Close this ticket and save transcript')
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for closing the ticket')
        .setRequired(false)
    ),
  category: 'ticket',
  async execute(interaction) {
    return handlers.closeTicket(interaction);
  }
};