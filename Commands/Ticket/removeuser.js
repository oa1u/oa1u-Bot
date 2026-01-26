const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { MessageFlags } = require('discord.js');
const { ticketCategory } = require("../../Config/constants/channel.json");
const { SupportRole } = require("../../Config/constants/roles.json");
const { sendErrorReply, createSuccessEmbed } = require("../../Functions/EmbedBuilders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeuser')
    .setDescription('Remove a member\'s access from the current ticket conversation')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to remove from the ticket')
        .setRequired(true)
    ),
  category: 'ticket',
  async execute(interaction) {
    // Verify this is a ticket channel
    if (interaction.channel.parentId !== ticketCategory) {
      return sendErrorReply(
        interaction,
        'Invalid Channel',
        'This command can only be used in a ticket channel!'
      );
    }

    const member = interaction.member;
    const targetUser = interaction.options.getUser('user');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return sendErrorReply(
        interaction,
        'User Not Found',
        'Could not find that user in this server!'
      );
    }

    // Check permissions (ticket owner, support, or admin)
    const ticketOwnerName = interaction.channel.name.replace('ticket-', '').split(' - ')[0];
    const isTicketOwner = member.user.username.toLowerCase() === ticketOwnerName.toLowerCase();
    const hasSupport = member.roles.cache.has(SupportRole);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isTicketOwner && !hasSupport && !isAdmin) {
      return sendErrorReply(
        interaction,
        'No Permission',
        'Only the ticket owner or support staff can remove users!'
      );
    }

    // Prevent removing the ticket owner
    if (targetUser.username.toLowerCase() === ticketOwnerName.toLowerCase()) {
      return sendErrorReply(
        interaction,
        'Cannot Remove Owner',
        'You cannot remove the ticket owner from their own ticket!'
      );
    }

    // Remove permissions for the user
    await interaction.channel.permissionOverwrites.delete(targetMember);

    const successEmbed = createSuccessEmbed(
      'User Removed from Ticket',
      `**${targetUser}** has been removed from this ticket.\n\n━━━━━━━━━━━━━━━━━━━━━`
    ).addFields(
      { name: '👤 Removed User', value: `${targetUser.tag}\n\`${targetUser.id}\``, inline: true },
      { name: '➖ Removed By', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
      { name: '🔒 Access Revoked', value: 'User can no longer view or interact with this ticket', inline: false }
    ).setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });
  }
};