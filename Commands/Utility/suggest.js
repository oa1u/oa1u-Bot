const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MySQLDatabaseManager = require('../../Functions/MySQLDatabaseManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit a suggestion for the server')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Brief title for your suggestion')
                .setRequired(true)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Detailed description of your suggestion')
                .setRequired(true)
                .setMaxLength(1000)),
    execute: async (interaction) => {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Create suggestion in database
            const suggestionId = await MySQLDatabaseManager.createSuggestion(
                guildId,
                userId,
                title,
                description
            );

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ 
                    name: `💡 Suggestion #${suggestionId}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTitle(title)
                .setDescription(description)
                .addFields(
                    { name: '👤 Submitted by', value: `<@${userId}>`, inline: true },
                    { name: '📊 Status', value: '🟡 **Pending**', inline: true },
                    { name: '📈 Votes', value: '👍 0 | 👎 0', inline: true }
                )
                .setFooter({ text: 'Vote using the reactions below!' })
                .setTimestamp();

            // Send to channel
            const response = await interaction.reply({
                embeds: [embed],
                withResponse: true
            });
            const msg = response?.resource?.message || await interaction.fetchReply();

            // Add voting reactions
            await msg.react('👍');
            await msg.react('👎');

            // Update suggestion with message ID
            await MySQLDatabaseManager.updateSuggestionMessageId(suggestionId, msg.id);

            console.log(`[Suggestion] Created suggestion #${suggestionId} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('[Suggestion] Error creating suggestion:', error);
            await interaction.reply({
                content: '❌ Failed to create suggestion. Please try again later.',
                ephemeral: true
            });
        }
    }
};
