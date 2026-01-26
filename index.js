require("dotenv").config({ path: "./Config/credentials.env" });
// Discord bot stuff
const { Client, Collection, GatewayIntentBits, MessageFlags, Partials } = require("discord.js");
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  presence: require("./Config/presence.json"),
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.events = new Collection();

// Utility function to recursively get files
function* getCommandFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('_')) {
      yield* getCommandFiles(filePath);
    } else if (file.endsWith('.js') && !file.startsWith('_')) {
      yield filePath;
    }
  }
}

// Register commands with Discord API
async function registerCommands() {
  const TOKEN = process.env.TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID;

  if (!TOKEN || !CLIENT_ID) {
    console.error('❌ Missing TOKEN or CLIENT_ID in environment variables');
    return false;
  }

  const commands = [];
  const commandsPath = path.join(__dirname, 'Commands');

  try {
    for (const filePath of getCommandFiles(commandsPath)) {
      try {
        const command = require(filePath);
        if (command.data) {
          commands.push(command.data.toJSON());
        }
      } catch (err) {
        console.error(`  ❌ Error loading command ${filePath}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('❌ Error scanning command directory:', err.message);
    return false;
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log(`\n⚙️  Registering ${commands.length} application (/) commands...`);

    const route = GUILD_ID 
      ? `/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands`
      : `/applications/${CLIENT_ID}/commands`;

    const data = await rest.put(route, { body: commands });
    console.log(`✅ Successfully registered ${data.length} application (/) commands.\n`);
    return true;
  } catch (error) {
    console.error('❌ Error registering commands:', error.message);
    return false;
  }
}

// Helper function to send error response
async function sendCommandErrorResponse(interaction) {
  const errorMessage = {
    content: '❌ There was an error while executing this command!',
    flags: MessageFlags.Ephemeral
  };

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  } catch (err) {
    console.error('Failed to send error response:', err.message);
  }
}

// Initialize loaders and handlers
async function initializeBot() {
  console.log('\n🚀 Initializing bot...\n');
  
  // Load events
  await require("./Events/_loader")(client);
  
  // Load commands
  await require("./Commands/_slashLoader")(client.slashCommands).catch((err) => {
    console.error("❌ Error loading slash commands:", err.message);
    process.exit(1);
  });
  
  // Register with Discord API
  const registered = await registerCommands();
  if (registered === false) {
    console.warn('⚠️  Command registration failed, but continuing with bot startup...');
  }
  
  // Load logging
  require("./Logging/index")(client);
}

// Interaction handler for slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);

  if (!command) {
    console.warn(`⚠️  No command matching /${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing command /${interaction.commandName}:`, error.message);
    await sendCommandErrorResponse(interaction);
  }
});

// Startup complete event
client.once("clientReady", () => {
  client.emit("commandsAndEventsLoaded", 1);
});

// Global error handlers to prevent crashes
client.on('error', (err) => {
  console.error('❌ Client error:', err.message);
});
client.on('warn', (msg) => {
  console.warn('⚠️  Client warn:', msg);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await client.destroy();
  process.exit(0);
});

// Register commands and login
(async () => {
  try {
    await initializeBot();
    client.login(process.env.TOKEN);
  } catch (err) {
    console.error('❌ Fatal error during startup:', err.message);
    process.exit(1);
  }
})();