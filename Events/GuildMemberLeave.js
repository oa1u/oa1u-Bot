const { EmbedBuilder } = require('discord.js');
const MySQLDatabaseManager = require('../Functions/MySQLDatabaseManager');

// When a member leaves, send a friendly goodbye message and log their departure in the database.
// Also logs their departure to the database
module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      // Log that this member left the server, so we can track activity.
      await MySQLDatabaseManager.logMemberActivity(
        member.id,
        member.user.tag,
        'leave',
        member.guild.id
      );
      
      const { leaveChannelId } = require('../Config/constants/channel.json');
      
      // If there's no leave channel set up, just warn and skip.
      if (!leaveChannelId || leaveChannelId === '') {
        console.warn('[Leave] Channel not configured');
        return;
      }
      
      const channel = member.guild.channels.cache.get(leaveChannelId);
      if (!channel) {
        console.warn(`[Leave] Channel ${leaveChannelId} not found`);
        return;
      }
      
      // Figure out how long the member was in the server.
      const joinedTimestamp = member.joinedTimestamp;
      const memberAge = Date.now() - joinedTimestamp;
      const days = Math.floor(memberAge / (1000 * 60 * 60 * 24));
      const hours = Math.floor((memberAge % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      let ageString = '';
      if (days > 0) ageString += `${days}d `;
      ageString += `${hours}h`;
      
      // Build a nice-looking embed to say goodbye.
      const leaveEmbed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('👋 Member Left')
        .setDescription(`${member.user.tag} left the server.`)
        .addFields(
          { name: '👤 Member Name', value: `${member.user.tag}`, inline: true },
          { name: '🆔 User ID', value: `${member.id}`, inline: true },
          { name: '⏱️ Time in Server', value: ageString, inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👥 Members Remaining', value: `${member.guild.memberCount}`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `User left • ID: ${member.id}` })
        .setTimestamp();
      
      // If the member had any roles (besides @everyone), list them in the embed.
      if (member.roles.cache.size > 1) {
        const roleList = member.roles.cache
          .filter(role => !role.isEveryone)
          .map(role => `<@&${role.id}>`)
          .join(', ');
        
        if (roleList) {
          leaveEmbed.addFields({
            name: '🏷️ Roles',
            value: roleList,
            inline: false
          });
        }
      }
      
      await channel.send({ embeds: [leaveEmbed] }).catch((err) => {
        console.error(`[Leave] Couldn't send message: ${err.message}`);
      });

    } catch (error) {
      console.error(`[Leave] Error: ${error.message}`);
    }
  }
};