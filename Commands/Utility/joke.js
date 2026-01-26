const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Retrieve a random joke from the Official Joke API'),
  category: 'utility',
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke');
      const jokeData = await response.json();
      
      const em = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('😂 Random Joke')
        .setDescription(`**${jokeData.setup}**\n\n${jokeData.punchline}`)
        .addFields({ name: 'Type', value: jokeData.type, inline: true })
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [em] });
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xF04747)
        .setTitle('❌ Error')
        .setDescription('Could not fetch a joke. Please try again!');
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};