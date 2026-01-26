const { Collection } = require('discord.js');

// Store active giveaways
const activeGiveaways = new Collection();

// Utility function to convert seconds to readable time
function toTime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? `${d}${d === 1 ? ' day' : ' days'}, ` : '';
    const hDisplay = h > 0 ? `${h}${h === 1 ? ' hour' : ' hours'}, ` : '';
    const mDisplay = m > 0 ? `${m}${m === 1 ? ' minute' : ' minutes'}, ` : '';
    const sDisplay = s > 0 ? `${s}${s === 1 ? ' second' : ' seconds'}` : '';
    
    const result = `${dDisplay}${hDisplay}${mDisplay}${sDisplay}`.replace(/, $/, '');
    return result || '0 seconds';
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    name: 'giveaway',
    description: 'Manage giveaways in your server',
    
    async handleGiveaway(interaction, client) {
        const { AdminRole } = require('../Config/constants/roles.json');
        const { giveawayChannel } = require('../Config/constants/channel.json');
        
        // Parse duration string (e.g., "10m", "1h", "2d")
        function parseDuration(durationStr) {
            const regex = /^(\d+)([mhd])$/i;
            const match = durationStr.toLowerCase().match(regex);
            
            if (!match) return null;
            
            const value = parseInt(match[1]);
            const unit = match[2];
            
            let seconds = 0;
            switch (unit) {
                case 'm': seconds = value * 60; break;
                case 'h': seconds = value * 3600; break;
                case 'd': seconds = value * 86400; break;
                default: return null;
            }
            
            return seconds;
        }
        
        // Get the giveaway channel
        const channel = interaction.guild.channels.cache.get(giveawayChannel);
        if (!channel) {
            const embed = {
                color: 16711680,
                title: '⚠️ Configuration Error',
                description: 'The **Giveaway Event** is currently not setup properly.',
                footer: { text: 'Setup Required' },
                timestamp: new Date()
            };
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Check permissions
        if (!interaction.member.roles.cache.has(AdminRole)) {
            const embed = {
                color: 16711680,
                title: '🚫 Access Denied',
                description: `You do not have permission to start giveaways.\n\nOnly users with the <@&${AdminRole}> role can use this command.`,
                footer: { text: 'Permission Required' },
                timestamp: new Date()
            };
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const durationInput = interaction.options.getString('duration');
        const duration = parseDuration(durationInput);
        const prize = interaction.options.getString('prize');

        if (!duration) {
            const embed = {
                color: 16744171,
                title: '⏳ Invalid Duration Format',
                description: 'Duration format is invalid.\n\n**Valid Formats:**\n• **Minutes:** `10m`, `30m`, `60m`\n• **Hours:** `1h`, `2h`, `12h`\n• **Days:** `1d`, `2d`, `7d`\n\n**Examples:**\n• `/giveaway 10m Nitro`\n• `/giveaway 1h Discord Boost`\n• `/giveaway 2d iPhone 15`',
                footer: { text: 'Use the correct format and try again' },
                timestamp: new Date()
            };
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const maxDuration = 7 * 86400; // 7 days in seconds
        if (duration < 60 || duration > maxDuration) {
            const embed = {
                color: 16744171,
                title: '⏳ Invalid Duration Range',
                description: 'Duration must be between **1 minute** and **7 days**.\n\n**Valid Range:**\n• Minimum: `1m` (1 minute)\n• Maximum: `7d` (7 days)',
                footer: { text: 'Check your duration and try again' },
                timestamp: new Date()
            };
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!prize || prize.length < 2 || prize.length > 100) {
            const embed = {
                color: 16744171,
                title: '🎁 Invalid Prize',
                description: 'Prize name must be between 2 and 100 characters.\n\n**Requirements:**\n• Minimum: 2 characters\n• Maximum: 100 characters',
                footer: { text: 'Check your prize name and try again' },
                timestamp: new Date()
            };
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        // Create giveaway embed
        const startEmbed = {
            color: 16766680,
            title: '🎉 New Giveaway Started!',
            description: '━━━━━━━━━━━━━━━━━━━━━\n\n✨ **React with 🎉 below to enter!**\n\n━━━━━━━━━━━━━━━━━━━━━',
            fields: [
                { name: '🎁 Prize', value: `**${prize}**`, inline: true },
                { name: '⏱️ Duration', value: `**${toTime(duration)}**`, inline: true },
                { name: '👤 Hosted by', value: `${interaction.user}`, inline: true },
                { name: '🎪 Current Participants', value: '0', inline: true },
                { name: '📋 How to Participate', value: 'Click the 🎉 reaction button below to enter the giveaway!', inline: false }
            ],
            footer: { text: '🍀 Good luck! Winner will be selected randomly.' },
            timestamp: new Date()
        };

        try {
            // Send giveaway message
            const giveawayMessage = await channel.send({ embeds: [startEmbed] });
            await giveawayMessage.react('🎉');

            // Store giveaway data
            const giveawayId = giveawayMessage.id;
            activeGiveaways.set(giveawayId, {
                messageId: giveawayMessage.id,
                channelId: channel.id,
                guildId: interaction.guildId,
                hostId: interaction.user.id,
                hostName: interaction.user.username,
                prize: prize,
                endTime: Date.now() + (duration * 1000),
                participants: new Set(),
                duration: duration
            });

            // Confirm to user
            const successEmbed = {
                color: 65280,
                title: '✅ Giveaway Started Successfully!',
                description: `━━━━━━━━━━━━━━━━━━━━━\n\n🎉 Your giveaway has been posted to ${channel}!\n\n**The countdown has begun!**\n\n━━━━━━━━━━━━━━━━━━━━━`,
                fields: [
                    { name: '🎁 Prize', value: `**${prize}**`, inline: true },
                    { name: '⏱️ Duration', value: `**${toTime(duration)}**`, inline: true },
                    { name: '📊 Status', value: '**Active** 🟢', inline: true }
                ],
                footer: { text: 'Watch the giveaway progress in real-time!' },
                timestamp: new Date()
            };
            await interaction.editReply({ embeds: [successEmbed] });

            // Run countdown
            await runGiveawayCountdown(giveawayMessage, giveawayId, client, duration, prize, interaction.user.username);

        } catch (error) {
            console.error('Error starting giveaway:', error);
            const errorEmbed = {
                color: 16711680,
                title: '❌ Error Creating Giveaway',
                description: 'An error occurred while trying to start the giveaway.\n\n**Please try again later or contact an administrator if the problem persists.**',
                fields: [
                    { name: '🔍 Error Details', value: `\`${error.message}\``, inline: false }
                ],
                footer: { text: 'If this issue continues, check your configuration' },
                timestamp: new Date()
            };
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function runGiveawayCountdown(message, giveawayId, client, duration, prize, host) {
    let timeRemaining = duration;
    const updateInterval = Math.min(30, Math.max(5, Math.floor(duration / 10))); // Update every 30 secs or 10% of duration

    while (timeRemaining > 0) {
        await sleep(updateInterval * 1000);
        timeRemaining -= updateInterval;

        try {
            // Fetch fresh reaction count
            const reaction = message.reactions.cache.get('🎉');
            const participantCount = reaction ? reaction.count - 1 : 0; // -1 for bot reaction

            const countdownEmbed = {
                color: 16766680,
                title: '🎉 Giveaway in Progress!',
                description: '━━━━━━━━━━━━━━━━━━━━━\n\n⏳ **Giveaway is still running!**\n\n━━━━━━━━━━━━━━━━━━━━━',
                fields: [
                    { name: '🎁 Prize', value: `**${prize}**`, inline: true },
                    { name: '⏱️ Time Remaining', value: `**${toTime(timeRemaining)}**`, inline: true },
                    { name: '👤 Hosted by', value: host, inline: true },
                    { name: '🎪 Participants', value: `**${participantCount}** 🎯`, inline: true }
                ],
                footer: { text: '⚡ Keep reacting to participate! The winner will be selected when time runs out.' },
                timestamp: new Date()
            };

            await message.edit({ embeds: [countdownEmbed] }).catch(() => {});
        } catch (error) {
            console.error('Error updating giveaway:', error);
        }
    }

    // Giveaway ended
    await finalizeGiveaway(message, giveawayId, client, prize, host);
}

async function finalizeGiveaway(message, giveawayId, client, prize, host) {
    try {
        // Fetch final reactions
        const reaction = await message.reactions.cache.get('🎉');
        const users = reaction ? await reaction.users.fetch() : new Map();
        
        // Filter out bot
        const participants = users.filter(user => !user.bot).map(user => user.username);

        let endEmbed;

        if (participants.length === 0) {
            endEmbed = {
                color: 16744171,
                title: '❌ No Winners',
                description: `━━━━━━━━━━━━━━━━━━━━━\n\nUnfortunately, nobody reacted to the **${prize}** giveaway.\n\n**Better luck next time!** 🍀\n\n━━━━━━━━━━━━━━━━━━━━━`,
                fields: [
                    { name: '🎁 Prize', value: `**${prize}**`, inline: true },
                    { name: '👥 Total Reactions', value: '0', inline: true }
                ],
                footer: { text: 'Giveaway Ended - No participants' },
                timestamp: new Date()
            };
        } else {
            const winner = participants[Math.floor(Math.random() * participants.length)];
            endEmbed = {
                color: 65280,
                title: '🏆 Giveaway Winner Announced!',
                description: `━━━━━━━━━━━━━━━━━━━━━\n\n🎉 **Congratulations ${winner}!** 🎉\n\nYou have won the **${prize}** giveaway!\n\n━━━━━━━━━━━━━━━━━━━━━`,
                fields: [
                    { name: '🎁 Prize Won', value: `**${prize}**`, inline: true },
                    { name: '🥇 Winner', value: `**${winner}**`, inline: true },
                    { name: '👥 Total Participants', value: `**${participants.length}**`, inline: true },
                    { name: '📊 Winning Chance', value: `**${((1 / participants.length) * 100).toFixed(2)}%**`, inline: true }
                ],
                footer: { text: '🎊 Giveaway Ended - Congratulations to the winner!' },
                timestamp: new Date()
            };
        }

        await message.edit({ embeds: [endEmbed] }).catch(() => {});
        activeGiveaways.delete(giveawayId);

    } catch (error) {
        console.error('Error finalizing giveaway:', error);
    }
}