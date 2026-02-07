const { SlashCommandBuilder } = require('discord.js');
const { handlers } = require('./ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketremoveuser')
    .setDescription('Remove a user from the current ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to remove from the ticket')
        .setRequired(true)
    ),
  category: 'ticket',
  async execute(interaction) {
    return handlers.removeUserFromTicket(interaction);
  }
};