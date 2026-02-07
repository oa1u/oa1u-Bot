const { EmbedBuilder } = require('discord.js');
const MySQLDatabaseManager = require('../Functions/MySQLDatabaseManager');

// When someone joins, send a warm welcome message and log their arrival in the database.
// Also logs member joins to database for tracking
module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      // Log that this member joined the server, so we can track activity.
      await MySQLDatabaseManager.logMemberActivity(
        member.id,
        member.user.tag,
        'join',
        member.guild.id
      );
      
      // Add the user to the userinfo table if we're using the new schema.
      const userInfoAdded = await MySQLDatabaseManager.addUserInfo(
        member.id,
        member.user.username,
        member.user.bot
      );
      if (userInfoAdded) {
        console.log(`[Database] User ${member.user.tag} (${member.id}) added to userinfo table`);
      }
      
      // Make sure the user has a record in the levels table.
      try {
        await MySQLDatabaseManager.connection.pool.query(
          `INSERT INTO levels (user_id, username, level, xp, messages, created_at)
           VALUES (?, ?, 1, 0, 0, NOW())
           ON DUPLICATE KEY UPDATE username = ?`,
          [member.id, member.user.username, member.user.username]
        );
        console.log(`[Database] User ${member.user.tag} (${member.id}) initialized in levels table`);
      } catch (dbErr) {
        console.warn(`[Database] Could not initialize user in levels table: ${dbErr.message}`);
      }
      
      const { welcomeChannelId } = require('../Config/constants/channel.json');
      
      // If there's no welcome channel set up, just warn and skip.
      if (!welcomeChannelId || welcomeChannelId === '') {
        console.warn('[Welcome] Welcome channel not configured');
        return;
      }
      
      // If the channel doesn't exist, warn and skip.
      const channel = member.guild.channels.cache.get(welcomeChannelId);
      if (!channel) {
        console.warn(`[Welcome] Welcome channel ${welcomeChannelId} not found`);
        return;
      }
      
      // Build a nice-looking embed to welcome the new member.
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x43B581)
        .setTitle('👋 Welcome to the Server!')
        .setDescription(`Welcome ${member}, we're happy to have you here!`)
        .addFields(
          { name: '👤 Member Name', value: `${member.user.tag}`, inline: true },
          { name: '🆔 User ID', value: `${member.id}`, inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👥 Total Members', value: `${member.guild.memberCount}`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `User joined • ID: ${member.id}` })
        .setTimestamp();
      
      await channel.send({ embeds: [welcomeEmbed] }).catch((err) => {
        console.error(`[Welcome] Failed to send welcome message: ${err.message}`);
      });
    } catch (error) {
      console.error(`[Welcome] Error in welcome handler: ${error.message}`);
    }
  }
};