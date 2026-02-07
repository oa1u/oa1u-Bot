const MySQLDatabaseManager = require('../Functions/MySQLDatabaseManager');
const { EmbedBuilder } = require('discord.js');

// Handles upvotes and downvotes on suggestions. Tracks reactions and updates the suggestion status.
module.exports = {
    name: 'messageReactionAdd',
    runOnce: false,
    call: async (client, args) => {
        const [reaction, user] = args;
        
        if (user.bot) return;
        
        // Make sure we have the full reaction data if it's partial.
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[Suggestion Reaction] Could not fetch partial reaction:', error);
                return;
            }
        }

        const message = reaction.message;
        if (!message || !message.guild) return;

        // Is this a suggestion message? Let's check.
        const suggestion = await MySQLDatabaseManager.getSuggestionByMessageId(message.id);
        if (!suggestion) return;

        // Only handle thumbs up/down reactions.
        if (reaction.emoji.name !== '👍' && reaction.emoji.name !== '👎') return;

        try {
            // Register the vote in the database.
            await MySQLDatabaseManager.voteSuggestion(
                suggestion.suggestion_id,
                user.id,
                reaction.emoji.name === '👍' ? 'upvote' : 'downvote'
            );

            // Get the updated suggestion info.
            const updated = await MySQLDatabaseManager.getSuggestion(suggestion.suggestion_id);
            if (!updated) return;

            // Update the embed to show new vote counts.
            const statusEmojis = {
                'pending': '🟡',
                'approved': '✅',
                'denied': '❌',
                'implemented': '🎉'
            };

            const embed = EmbedBuilder.from(message.embeds[0])
                .spliceFields(2, 1, { 
                    name: '📈 Votes', 
                    value: `👍 ${updated.upvotes} | 👎 ${updated.downvotes}`, 
                    inline: true 
                });

            await message.edit({ embeds: [embed] });

        } catch (error) {
            console.error('[Suggestion Reaction] Error handling vote:', error);
        }
    }
};