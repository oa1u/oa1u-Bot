const { ChannelType, PermissionFlagsBits } = require("discord.js");
const jointocreatemap = new Map();
const { jointocreatechannel, jointocreatecategory } = require("../Config/constants/channel.json");
const { serverID } = require("../Config/main.json");

let cleanupStarted = false;

module.exports = {
  name: "voiceStateUpdate",
  runOnce: false,
  call: async (client, args) => {
    const [oldState, newState] = args;

    // Start cleanup interval once
    if (!cleanupStarted) {
      cleanupStarted = true;
      setInterval(() => {
        try {
          const guild = client.guilds.cache.get(serverID);
          if (!guild) return;
          const channels = guild.channels.cache.map(ch => ch.id);
          for (let i = 0; i < channels.length; i++) {
            const key = `tempvoicechannel_${guild.id}_${channels[i]}`;
            if (jointocreatemap.get(key)) {
              const vc = guild.channels.cache.get(jointocreatemap.get(key));
              if (vc && vc.members.size < 1) {
                jointocreatemap.delete(key);
                vc.delete().catch(() => {});
              }
            }
          }
        } catch (err) {
          console.error('[JoinToCreate] Cleanup error:', err);
        }
      }, 10000);
    }

    // Ignore bot-less states
    if (!oldState && !newState) return;

    const oldChannelId = oldState?.channelId;
    const newChannelId = newState?.channelId;

    // Join event
    if (!oldChannelId && newChannelId) {
      if (newChannelId !== jointocreatechannel) return;
      await createTempChannel(newState);
      return;
    }

    // Leave event
    if (oldChannelId && !newChannelId) {
      const key = `tempvoicechannel_${oldState.guild.id}_${oldChannelId}`;
      if (jointocreatemap.get(key)) {
        const vc = oldState.guild.channels.cache.get(jointocreatemap.get(key));
        if (!vc) {
          jointocreatemap.delete(key);
          return;
        }
        if (vc.members.size < 1) {
          jointocreatemap.delete(key);
          vc.delete().catch(() => {});
        }
      }
      return;
    }

    // Move event
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      if (newChannelId === jointocreatechannel) {
        await createTempChannel(oldState);
      }

      // Cleanup old temp channel if empty
      const key = `tempvoicechannel_${oldState.guild.id}_${oldChannelId}`;
      if (jointocreatemap.get(key)) {
        const vc = oldState.guild.channels.cache.get(jointocreatemap.get(key));
        if (!vc) {
          jointocreatemap.delete(key);
          return;
        }
        if (vc.members.size < 1) {
          jointocreatemap.delete(key);
          vc.delete().catch(() => {});
        }
      }
    }
  }
};

async function createTempChannel(userState) {
  try {
    const username = userState.member?.user?.username || userState.id;
    const guild = userState.guild;
    if (!guild) return;

    const vc = await guild.channels.create({
      name: `${username}'s room`,
      type: ChannelType.GuildVoice,
      parent: jointocreatecategory || undefined,
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

    await userState.setChannel(vc).catch(err => console.error('Error moving user into temp channel:', err));
    jointocreatemap.set(`tempvoicechannel_${vc.guild.id}_${vc.id}`, vc.id);
  } catch (err) {
    console.error('Error creating temp channel:', err);
  }
}