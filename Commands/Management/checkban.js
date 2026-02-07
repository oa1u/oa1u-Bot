const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const DatabaseManager = require('../../Functions/MySQLDatabaseManager');
const { moderatorRoleId, administratorRoleId } = require("../../Config/constants/roles.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkban')
    .setDescription('Look up ban info by case ID')
    .addStringOption(option =>
      option.setName('caseid')
        .setDescription('The case ID to look up')
        .setRequired(true)
    ),
  category: 'management',
  async execute(interaction) {
    const moderator = interaction.member;
    const caseID = interaction.options.getString('caseid');

    // Make sure the user running this command is a mod or admin.
    if (!moderator.roles.cache.has(moderatorRoleId) && !moderator.roles.cache.has(administratorRoleId)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('❌ No Permission')
        .setDescription('You need mod or admin role!');
      
      return interaction.reply({ embeds: [noPermEmbed], flags: MessageFlags.Ephemeral });
    }

    const warnsDB = DatabaseManager.getWarnsDB();
    const allData = await warnsDB.all();

    // Search every user's warnings for the given case ID.
    let foundCase = null;
    let foundUserId = null;

    for (const [userId, userData] of Object.entries(allData)) {
      if (userData.warns && userData.warns[caseID]) {
        foundCase = userData.warns[caseID];
        foundUserId = userId;
        break;
      }
    }

    if (!foundCase) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(0xF04747)
        .setTitle('❌ Case Not Found')
        .setDescription(`No ban/warn record found with case ID: \`${caseID}\``)
        .setTimestamp();
      
      return interaction.reply({ embeds: [notFoundEmbed], flags: MessageFlags.Ephemeral });
    }

    // Try to fetch user and moderator details from Discord for more info.
    let targetUser;
    let moderatorUser;
    
    try {
      targetUser = await interaction.client.users.fetch(foundUserId).catch(() => null);
      moderatorUser = await interaction.client.users.fetch(foundCase.moderator).catch(() => null);
    } catch (err) {
      console.error('Error fetching users:', err);
    }

    // Figure out if this is actually a ban or just a warning.
    const isBan = foundCase.reason && foundCase.reason.includes('(banned)');
    const actionType = isBan ? '🔨 Ban' : '⚠️ Warning';
    const embedColor = isBan ? 0xF04747 : 0xFAA61A;

    // Put together all the info to show in Discord.
    const caseEmbed = new EmbedBuilder()
      .setTitle(`${actionType} - Case ${caseID}`)
      .setColor(embedColor)
      .addFields(
        { 
          name: '👤 User', 
          value: targetUser 
            ? `${targetUser.tag}\n\`${foundUserId}\`` 
            : `Unknown User\n\`${foundUserId}\``,
          inline: true 
        },
        { 
          name: '👮 Moderator', 
          value: moderatorUser 
            ? `${moderatorUser.tag}\n\`${foundCase.moderator}\`` 
            : `Unknown Moderator\n\`${foundCase.moderator}\``,
          inline: true 
        },
        { 
          name: '📅 Date', 
          value: foundCase.date || 'Unknown',
          inline: true 
        },
        { 
          name: '📝 Reason', 
          value: foundCase.reason || 'No reason provided',
          inline: false 
        }
      )
      .setFooter({ text: `Case ID: ${caseID}` })
      .setTimestamp();

    // Show the user's avatar if we have it—makes the embed look nicer.
    if (targetUser) {
      caseEmbed.setThumbnail(targetUser.displayAvatarURL({ size: 128 }));
    }

    // Check if the user is still banned at this moment.
    if (isBan) {
      try {
        const banInfo = await interaction.guild.bans.fetch(foundUserId).catch(() => null);
        caseEmbed.addFields({
          name: '🔍 Current Status',
          value: banInfo ? '🔴 Currently Banned' : '🟢 No Longer Banned (Unbanned)',
          inline: true
        });
      } catch (err) {
        // If the user isn't found in the bans list, let them know.
        caseEmbed.addFields({
          name: '🔍 Current Status',
          value: '🟢 No Longer Banned',
          inline: true
        });
      }
    }

    await interaction.reply({ embeds: [caseEmbed] });
  }
};