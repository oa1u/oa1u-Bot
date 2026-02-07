const { SlashCommandBuilder } = require('discord.js');
const { handlers } = require('./ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketadduser')
    .setDescription('Add a user to the current ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to add to the ticket')
        .setRequired(true)
    ),
  category: 'ticket',
  async execute(interaction) {
    return handlers.addUserToTicket(interaction);
  }
};