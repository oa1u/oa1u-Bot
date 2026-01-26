const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { MessageFlags } = require('discord.js');
const { ticketCategory } = require("../../Config/constants/channel.json");
const { SupportRole } = require("../../Config/constants/roles.json");
const { sendErrorReply, createSuccessEmbed } = require("../../Functions/EmbedBuilders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adduser')
    .setDescription('Add a member to view and participate in the current ticket conversation')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to add to the ticket')
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
        'Only the ticket owner or support staff can add users!'
      );
    }

    // Add permissions for the user
    await interaction.channel.permissionOverwrites.create(targetMember, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    const successEmbed = createSuccessEmbed(
      'User Added to Ticket',
      `**${targetUser}** has been successfully added to this ticket!\n\n━━━━━━━━━━━━━━━━━━━━━`
    ).addFields(
      { name: '👤 Added User', value: `${targetUser.tag}\n\`${targetUser.id}\``, inline: true },
      { name: '➕ Added By', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
      { name: '🔓 Permissions Granted', value: '> View Channel\n> Send Messages\n> Read History\n> Attach Files', inline: false }
    ).setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

    // Notify the added user
    const notifyEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Added to Support Ticket')
      .setDescription(`${targetUser}\n\n━━━━━━━━━━━━━━━━━━━━━\n\nYou have been added to this ticket by ${interaction.user}.\n\n**You can now:**\n> 📖 View the conversation history\n> 💬 Send messages and help resolve the issue\n> 📎 Share files and screenshots`)
      .setFooter({ text: 'Ticket System' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [notifyEmbed] });
  }
};