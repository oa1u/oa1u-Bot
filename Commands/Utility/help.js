const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ServerInvite } = require("../../Config/main.json");
const { AdminRole, ModRole } = require("../../Config/constants/roles.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Command category to display')
        .setRequired(false)
        .addChoices(
          { name: 'Management', value: 'management' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Utility', value: 'utility' },
          { name: 'Ticket', value: 'ticket' },
        )
    ),
  category: 'utility',
  async execute(interaction) {
    const category = interaction.options.getString('category');
    
    // Check user roles
    const member = interaction.member;
    const hasAdminRole = member.roles.cache.has(AdminRole);
    const hasModRole = member.roles.cache.has(ModRole);

    function ChangeLatter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Category emojis
    const categoryIcons = {
      management: '⚙️',
      moderation: '🛡️',
      utility: '🔧',
      ticket: '🎫'
    };

    // Build category list based on permissions
    let categoryList = [];
    if (hasAdminRole) {
      categoryList.push('⚙️ **Management** - Server management commands');
    }
    if (hasModRole || hasAdminRole) {
      categoryList.push('🛡️ **Moderation** - Moderation & safety commands');
    }
    categoryList.push('🔧 **Utility** - Helpful utility commands');
    categoryList.push('🎫 **Ticket** - Ticket system commands');

    let embedhelp = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ 
        name: `${interaction.client.user.username} Help Menu`, 
        iconURL: interaction.client.user.displayAvatarURL() 
      })
      .setDescription(`Welcome to the help menu! Select a category below to view available commands.\n\n**How to use:** \`/help [category]\``)
      .addFields(
        { 
          name: '📚 Command Categories', 
          value: categoryList.join('\n'), 
          inline: false 
        },
        { 
          name: '🔗 Links', 
          value: `[Server Invite](${ServerInvite})`, 
          inline: false 
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (!category) {
      return interaction.reply({ embeds: [embedhelp], flags: MessageFlags.Ephemeral });
    }

    // Check permissions for specific categories
    if (category === 'management' && !hasAdminRole) {
      return interaction.reply({ 
        content: `❌ You do not have permission to view Management commands. This category requires the ${AdminRole} role.`, 
        flags: MessageFlags.Ephemeral 
      });
    }

    if (category === 'moderation' && !hasModRole && !hasAdminRole) {
      return interaction.reply({ 
        content: `❌ You do not have permission to view Moderation commands. This category requires the ${ModRole} role.`, 
        flags: MessageFlags.Ephemeral 
      });
    }

    const categoryEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ 
        name: `${ChangeLatter(category)} Commands`, 
        iconURL: interaction.client.user.displayAvatarURL() 
      })
      .setDescription(`${categoryIcons[category]} All commands in the **${ChangeLatter(category)}** category:\n`)
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    let count = 0;
    const commands = [];
    for (const [, command] of interaction.client.slashCommands) {
      if (command.category === category) {
        commands.push(`\`/${command.data.name}\` - ${command.data.description || 'No description'}`);
        count++;
      }
    }

    if (count === 0) {
      return interaction.reply({ content: `No commands found in the ${category} category.`, flags: MessageFlags.Ephemeral });
    }

    categoryEmbed.addFields({
      name: `Total Commands: ${count}`,
      value: commands.join('\n'),
      inline: false
    });

    return interaction.reply({ embeds: [categoryEmbed], flags: MessageFlags.Ephemeral });
  }
};