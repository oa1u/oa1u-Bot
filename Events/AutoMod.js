const { MessageFlags, EmbedBuilder } = require('discord.js');
const { AdminRole, ModRole } = require('../Config/constants/roles.json');
const { channelLog } = require('../Config/constants/channel.json');
const misc = require('../Config/constants/misc.json');
const blockedWordsList = require('../Config/constants/blockedWords.json');

// Fallback config
const blockedWords = Array.isArray(blockedWordsList) ? blockedWordsList : [];
const blockInvites = misc.blockInvites !== undefined ? misc.blockInvites : true;
const mentionThreshold = misc.mentionThreshold || 6;

const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]+)/gi;

module.exports = {
	name: 'messageCreate',
	runOnce: false,
	call: async (client, args) => {
		const [message] = args;
		if (!message || message.author.bot) return;
		if (!message.guild) return; // ignore DMs

		const member = message.member;
		const isStaff = member?.roles.cache.has(AdminRole) || member?.roles.cache.has(ModRole);
		if (isStaff) return; // staff bypass

		const lower = message.content.toLowerCase();
		let reason = null;

		// Block external Discord invite links; allow invites to this server
		if (blockInvites && /(discord\.gg|discord\.com\/invite)\//i.test(message.content)) {
			const codes = Array.from(message.content.matchAll(inviteRegex)).map(m => m[4]).filter(Boolean);
			if (codes.length) {
				for (const code of codes) {
					try {
						const invite = await message.client.fetchInvite(code);
						const inviteGuildId = invite?.guild?.id;
						if (inviteGuildId && inviteGuildId !== message.guild.id) {
							reason = `External invite detected (code: ${code})`;
							break;
						}
						// If no guild info, treat as external for safety
						if (!inviteGuildId) {
							reason = `External invite detected (code: ${code})`;
							break;
						}
					} catch (err) {
						// If fetch fails, assume external to stay safe
						reason = `External invite detected (code: ${code})`;
						break;
					}
				}
			}
		}

		// Block mass mentions
		const mentionCount = (message.mentions.users.size || 0) + (message.mentions.roles.size || 0);
		if (!reason && mentionThreshold > 0 && mentionCount >= mentionThreshold) {
			reason = `Mass mention (${mentionCount})`;
		}

		// Block banned words
		if (!reason && blockedWords.length) {
			const matched = blockedWords.find(w => w && lower.includes(String(w).toLowerCase()));
			if (matched) {
				reason = `Blocked word: ${matched}`;
			}
		}

		if (!reason) return;

		await message.delete().catch(() => {});

		const embed = new EmbedBuilder()
			.setColor(0xF04747)
			.setTitle('AutoMod Action')
			.setDescription(`Message removed in ${message.channel}`)
			.addFields(
				{ name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
				{ name: 'Reason', value: reason, inline: true },
				{ name: 'Content', value: message.content?.slice(0, 1024) || '*(no content)*' }
			)
			.setTimestamp();

		// Notify channel (quiet message)
		message.channel.send({ content: `${message.author}, your message was removed. Reason: ${reason}`, flags: MessageFlags.SuppressNotifications }).catch(() => {});

		// Log
		const logChannel = message.client.channels.cache.get(channelLog);
		if (logChannel) {
			logChannel.send({ embeds: [embed] }).catch(() => {});
		}
	}
};