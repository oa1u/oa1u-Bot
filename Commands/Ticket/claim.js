const { SlashCommandBuilder } = require('discord.js');
const { handlers } = require('./ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketclaim')
    .setDescription('Claim this ticket as yours'),
  category: 'ticket',
  async execute(interaction) {
    return handlers.claimTicket(interaction);
  }
};