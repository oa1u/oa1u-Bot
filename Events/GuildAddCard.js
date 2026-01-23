const { EmbedBuilder, ChannelType } = require('discord.js');
const { Color } = require("../Config/constants/misc.json");
const { channelLog } = require("../Config/constants/channel.json");

module.exports = {
    name: "guildMemberAdd",
    runOnce: false,
    call: async (client, args) => {
        if (!args || !args[0]) return;
        const member = args[0];
        const guild = member.guild;
        const guildLogChannel = guild.channels.cache.get(channelLog);
        
        if (!guildLogChannel) return;
        
        const embed = new EmbedBuilder()
            .setColor(Color)
            .setTitle("Member Joined")
            .setDescription(`${member.user.username} (${member.id}) has joined the server`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Member Count", value: `${guild.memberCount}`, inline: true }
            )
            .setTimestamp();
        
        guildLogChannel.send({ embeds: [embed] });
    }
};





