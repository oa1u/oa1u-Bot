const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { SupportRole } = require("../../Config/constants/roles.json");
const { ticketCategory } = require("../../Config/constants/channel.json");
const { sendErrorReply, createSuccessEmbed } = require("../../Functions/EmbedBuilders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('markhandled')
    .setDescription('Mark the current ticket as resolved and flag it with your username')
    .setDefaultMemberPermissions(0x2000),
  category: 'ticket',
  async execute(interaction) {
    if(!interaction.member.roles.cache.has(SupportRole)) {
      return sendErrorReply(
        interaction,
        'No Permission',
        'You need the Support role to mark tickets as handled!'
      );
    }

    if(interaction.channel.parentId !== ticketCategory) {
      return sendErrorReply(
        interaction,
        'Invalid Channel',
        'This command can only be used in ticket channels!'
      );
    }

    await interaction.channel.setName(interaction.channel.name + " - 🚩 - " + interaction.user.username);
    
    const successEmbed = createSuccessEmbed(
      'Ticket Marked as Handled',
      `This ticket has been flagged as resolved!\n\n━━━━━━━━━━━━━━━━━━━━━`
    ).addFields(
      { name: '👤 Handler', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
      { name: '🚩 Status', value: '**Handled**', inline: true },
      { name: '⏰ Marked At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      { name: '💡 Next Steps', value: 'The ticket owner can now close this ticket using `/close` or ❌ reaction', inline: false }
    ).setTimestamp();
    
    return interaction.reply({ embeds: [successEmbed] });
  }
}