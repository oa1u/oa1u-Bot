const DatabaseManager = require('../../Functions/MySQLDatabaseManager');
const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { moderatorRoleId } = require("../../Config/constants/roles.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('View all warnings for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User (optional)')
        .setRequired(false)
    ),
  category: 'moderation',
  async execute(interaction) {
    let Prohibited = new EmbedBuilder()
      .setColor(0xFAA61A)
        .setTitle(`Prohibited User`)
        .setDescription(`You have to be in the moderation team to look at other people's warnings`);
    
    // Check for Mod role permission
    if(!interaction.member.roles.cache.has(moderatorRoleId)) return interaction.reply({ embeds: [Prohibited], flags: MessageFlags.Ephemeral });
    
    const warnsDB = DatabaseManager.getWarnsDB();
    const userOption = interaction.options.getUser('user');

    // Use the user ID given, or default to the person running the command
    const targetUserId = userOption ? userOption.id : interaction.user.id;
    const viewingSelf = targetUserId === interaction.user.id;

    await warnsDB.ensure(targetUserId, { points: 0, warns: {} });

    const targetUserObj = await interaction.client.users.fetch(targetUserId).catch(() => null);
    const userLabel = targetUserObj ? `${targetUserObj.tag} (${targetUserId})` : `${targetUserId}`;

    const userData = await warnsDB.get(targetUserId);
    const warns = userData?.warns || {};
    const warnKeys = Object.keys(warns);
    const noneMsg = viewingSelf ? 'You have not been warned before' : 'User has not been warned before';
    const list = warnKeys.length ? warnKeys.map((id, idx) => `${idx + 1}. ${id}`).join('\n') : noneMsg;

    const em = new EmbedBuilder()
      .setTitle("Warnings")
      .setColor(0xFAA61A)
      .addFields(
        { name: "User", value: userLabel },
        { name: "Total warnings", value: `${warnKeys.length}` },
        { name: "Cases", value: `\`${list}\`` }
      );

    await interaction.reply({ embeds: [em], flags: MessageFlags.Ephemeral });
  }
}