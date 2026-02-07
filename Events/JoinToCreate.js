const { ChannelType, PermissionFlagsBits } = require("discord.js");
const MySQLDatabaseManager = require("../Functions/MySQLDatabaseManager");
const { joinToCreateChannelId, joinToCreateCategoryId } = require("../Config/constants/channel.json");
const { serverID } = require("../Config/main.json");

// Join-to-Create voice channel system
// This system lets users join a lobby voice channel and automatically get their own private temp channel.
// When they're done, the temp channel is deleted if it's empty.
module.exports = {
  name: "voiceStateUpdate",
  runOnce: false,
  call: async (client, args) => {
    const [oldState, newState] = args;

    // If both states are missing, ignore (probably a bot or weird event).
    if (!oldState && !newState) return;

    const oldChannelId = oldState?.channelId;
    const newChannelId = newState?.channelId;

    // If the user just joined a channel, check if it's the JTC lobby and create their temp channel.
    if (!oldChannelId && newChannelId) {
      if (newChannelId !== joinToCreateChannelId) return;
      await createTempChannel(newState);
      return;
    }

    // If the user just left a channel, check if it was a temp JTC channel and clean up if empty.
    if (oldChannelId && !newChannelId) {
      const jtcData = await MySQLDatabaseManager.getJTCChannel(oldChannelId);
      if (jtcData) {
        const vc = oldState.guild.channels.cache.get(jtcData.channel_id);
        if (!vc) {
          await MySQLDatabaseManager.deleteJTCChannel(oldChannelId);
          return;
        }
        if (vc.members.size < 1) {
          await MySQLDatabaseManager.deleteJTCChannel(oldChannelId);
          vc.delete().catch(err => {
            console.error(`[JoinToCreate] Failed to delete empty voice channel: ${err.message}`);
          });
        }
      }
      return;
    }

    // If the user moved between channels, check if they joined the JTC lobby and create a temp channel.
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      if (newChannelId === joinToCreateChannelId) {
        await createTempChannel(newState);
      }

      // If they left a temp channel, clean it up if it's empty.
      const jtcData = await MySQLDatabaseManager.getJTCChannel(oldChannelId);
      if (jtcData) {
        const vc = oldState.guild.channels.cache.get(jtcData.channel_id);
        if (!vc) {
          await MySQLDatabaseManager.deleteJTCChannel(oldChannelId);
          return;
        }
        if (vc.members.size < 1) {
          await MySQLDatabaseManager.deleteJTCChannel(oldChannelId);
          vc.delete().catch(err => {
            console.error(`[JoinToCreate] Failed to delete empty voice channel: ${err.message}`);
          });
        }
      }
    }
  }
};

async function createTempChannel(userState) {
  try {
    const username = userState.member?.user?.username || userState.id;
    const guild = userState.guild;
    if (!guild) {
      console.warn('[JTC] Guild not found');
      return;
    }

    const vc = await guild.channels.create({
      name: `${username}'s room`,
      type: ChannelType.GuildVoice,
      parent: joinToCreateCategoryId || undefined,
      userLimit: 14,
      permissionOverwrites: [
        {
          id: userState.id,
          allow: [PermissionFlagsBits.ManageChannels],
        },
        {
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    await userState.setChannel(vc).catch(err => console.error('[JoinToCreate] Error moving user into temp channel:', err.message));
    
    // Store channel in database
    await MySQLDatabaseManager.createJTCChannel(vc.id, userState.id, guild.id, vc.name);
  } catch (err) {
    console.error('[JoinToCreate] Error creating temp channel:', err.message);
  }
}