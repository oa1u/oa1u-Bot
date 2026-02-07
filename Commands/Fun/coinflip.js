const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');

// Flip a coin and see if you get heads or tails—totally random, just like real life!
module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and get heads or tails'),
  category: 'fun',
  async execute(interaction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const emoji = result === 'Heads' ? '🪙' : '💿';
    
    const em = new EmbedBuilder()
      .setColor(result === 'Heads' ? 0xFFD700 : 0xC0C0C0)
      .setTitle('🪙 Coin Flip')
      .setDescription(`The coin landed on **${result}**! ${emoji}`)
      .setTimestamp();
    
    await interaction.reply({ embeds: [em] });
  }
};