require("dotenv").config({ path: "./Config/credentials.env", override: false, debug: false, quiet: true });
const { Client, Collection, GatewayIntentBits, MessageFlags, Partials, PermissionFlagsBits } = require("discord.js");
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');
const { updateStats } = require('./Functions/botStats');
const eventLoader = require('./Events/_loader');

const { EmbedBuilder: DiscordEmbedBuilder } = require('discord.js');
let BuildersEmbedBuilder = null;
try {
  BuildersEmbedBuilder = require('@discordjs/builders').EmbedBuilder;
} catch (err) {
  BuildersEmbedBuilder = null;
}

const appName = require('./package.json')?.name || 'Bot';
const DEFAULT_EMBED_COLOR = 0x5865F2;
const DEFAULT_EMBED_FOOTER = `${appName} • System`;

function applyEmbedDefaults(embed) {
  if (!embed?.data) return;
  if (!embed.data.color) embed.setColor(DEFAULT_EMBED_COLOR);
  if (!embed.data.timestamp) embed.setTimestamp();
  if (!embed.data.footer?.text) embed.setFooter({ text: DEFAULT_EMBED_FOOTER });
}

function patchEmbedBuilder(EmbedBuilder) {
  if (!EmbedBuilder || EmbedBuilder.prototype.__embedDefaultsPatched) return;
  const originalToJSON = EmbedBuilder.prototype.toJSON;
  EmbedBuilder.prototype.toJSON = function (...args) {
    applyEmbedDefaults(this);
    return originalToJSON.apply(this, args);
  };
  EmbedBuilder.prototype.__embedDefaultsPatched = true;
}

patchEmbedBuilder(DiscordEmbedBuilder);
patchEmbedBuilder(BuildersEmbedBuilder);

// Initialize the Discord client with all the intents we need
// TODO: maybe reduce these later if we don't need all of them
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

// Collections to store commands and events
client.commands = new Collection();
client.slashCommands = new Collection();
client.events = new Collection();

// Helper function to recursively get all command files
// Skips folders/files starting with underscore
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

// Register slash commands with Discord
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
    // Loop through all command files and load them
    for (const filePath of getCommandFiles(commandsPath)) {
      try {
        const command = require(filePath);
        if (command.data) {
          const json = command.data.toJSON();
          const category = command.category || 'uncategorized';

          if (!json.default_member_permissions) {
            if (category === 'moderation') {
              json.default_member_permissions = PermissionFlagsBits.ModerateMembers.toString();
            }
            if (category === 'management') {
              json.default_member_permissions = PermissionFlagsBits.Administrator.toString();
            }
          }

          commands.push(json);
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
    console.log(`\n⚙️  Registering ${commands.length} commands...`);

    // Register to guild (faster) or globally (slower but works everywhere)
    const route = GUILD_ID 
      ? `/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands`
      : `/applications/${CLIENT_ID}/commands`;

    const data = await rest.put(route, { body: commands });
    console.log(`✅ ${data.length} commands registered\n`);
    return true;
  } catch (error) {
    console.error('❌ Error registering commands:', error.message);
    return false;
  }
}

// Send a generic error message when a command fails
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

async function initializeBot() {
  try {
    console.log('\n🚀 Starting up...');
    
    // Initialize MySQL connection first
    const DatabaseManager = require('./Functions/MySQLDatabaseManager');
    await DatabaseManager.initialize();
    
    await eventLoader(client);
    
    await require("./Commands/_slashLoader")(client.slashCommands).catch((err) => {
      console.error("❌ Couldn't load commands:", err.message);
      process.exit(1);
    });
    
    const registered = await registerCommands();
    if (!registered) {
      console.warn('⚠️  Command registration failed but continuing anyway...');
    }
    
    require("./Logging/index")(client);
    restoreGiveaways(client);
    startReminderChecker(client);
  } catch (error) {
    console.error('❌ Fatal error during bot initialization:', error);
    process.exit(1);
  }
}

/**
 * Start the reminder checker that runs periodically to check for pending reminders
 */
function startReminderChecker(client) {
  const { reminderCheckInterval } = require('./Config/constants/misc.json').timeouts;
  
  // Check immediately on startup
  checkPendingReminders(client);
  
  // Check every so often
  setInterval(() => {
    checkPendingReminders(client);
  }, reminderCheckInterval);
  
  console.log(`⏰ Reminder system started (checking every ${reminderCheckInterval / 1000}s)`);

  // Schedule cleanup of inactive join_to_create entries (every 24 hours)
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(async () => {
    try {
      const MySQLDatabaseManager = require('./Functions/MySQLDatabaseManager');
      await MySQLDatabaseManager.deleteInactiveJoinToCreate(7); // Delete inactive entries older than 7 days
    } catch (error) {
      console.error('Error running join_to_create cleanup:', error);
    }
  }, cleanupInterval);
  
  console.log(`🧹 Join-to-create cleanup scheduler started (running every 24 hours)`);
}

// Check and deliver any pending reminders
async function checkPendingReminders(client) {
  try {
    const DatabaseManager = require('./Functions/MySQLDatabaseManager');
    const { EmbedBuilder } = require('discord.js');
    const moment = require('moment-timezone');
    const { reminders: reminderConfig } = require('./Config/constants/misc.json');
    
    const remindDB = DatabaseManager.getRemindersDB();
    const now = Date.now();
    
    // Get all reminders
    const allReminders = Object.values(await remindDB.all());
    
    for (const reminder of allReminders) {
      // Skip if already completed
      if (reminder.completed) continue;
      
      // Skip if not yet due
      if (reminder.triggerAt > now) continue;
      
      try {
        // Initialize delivery attempt tracking
        if (!reminder.deliveryAttempts) {
          reminder.deliveryAttempts = 0;
        }
        
        // Fetch user
        const user = await client.users.fetch(reminder.userId).catch(() => null);
        if (!user) {
          console.log(`[Remind] User not found for reminder ${reminder.id}: ${reminder.userId}`);
          reminder.completed = true;
          await remindDB.set(reminder.id, reminder);
          continue;
        }
        
        // Create reminder embed
        const reminderEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🔔 Reminder!')
          .setDescription(reminder.message)
          .setFooter({ text: `Set ${moment(reminder.createdAt).fromNow()}` })
          .setTimestamp();
        
        try {
          // Attempt to send reminder DM first - mark as completed ONLY after successful send
          await user.send({ embeds: [reminderEmbed] });
          console.log(`[Remind] Reminder delivered to ${user.tag}`);
          
          // ONLY mark as completed AFTER successful send to prevent race conditions
          reminder.completed = true;
          await remindDB.set(reminder.id, reminder);
          
          // Clean up after a delay
          setTimeout(async () => {
            await remindDB.delete(reminder.id);
          }, 300000); // Keep for 5 minutes then delete
          
        } catch (dmError) {
          // DM failed - implement retry logic
          reminder.deliveryAttempts++;
          reminder.lastFailureReason = dmError.message;
          reminder.lastFailureTime = Date.now();
          
          console.warn(`[Remind] DM delivery failed for ${user.tag} (attempt ${reminder.deliveryAttempts}/${reminderConfig.maxDeliveryAttempts}): ${dmError.message}`);
          
          // Check if we've exceeded max attempts
          if (reminder.deliveryAttempts >= reminderConfig.maxDeliveryAttempts) {
            console.error(`[Remind] Max delivery attempts reached for reminder ${reminder.id}`);
            
            // Try to notify in notification channel
            const notificationChannelId = reminderConfig.notificationChannelId;
            if (notificationChannelId && notificationChannelId !== 'YOUR_NOTIFICATIONS_CHANNEL_ID') {
              try {
                const channel = await client.channels.fetch(notificationChannelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                  const failedEmbed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ Reminder Delivery Failed')
                    .setDescription(`Could not deliver reminder to <@${reminder.userId}>`)
                    .addFields(
                      { name: '💬 Message', value: reminder.message, inline: false },
                      { name: '⚠️ Reason', value: dmError.message, inline: false },
                      { name: '📝 Note', value: 'User may have DMs disabled or has left the server', inline: false }
                    )
                    .setFooter({ text: `Reminder ID: ${reminder.id}` })
                    .setTimestamp();
                  
                  await channel.send({ embeds: [failedEmbed] }).catch(sendErr => {
                    console.error(`[Remind] Failed to notify staff channel: ${sendErr.message}`);
                  });
                  console.log(`[Remind] Notified staff channel about failed reminder for ${reminder.userId}`);
                }
              } catch (notifyError) {
                console.error(`[Remind] Could not send notification to staff channel: ${notifyError.message}`);
              }
            }
            
            // Mark as completed after max attempts
            reminder.completed = true;
            await remindDB.set(reminder.id, reminder);
          } else {
            // Schedule retry - reset triggerAt to retry in configured minutes
            const retryDelayMs = reminderConfig.retryDelayMinutes * 60 * 1000;
            reminder.triggerAt = Date.now() + retryDelayMs;
            console.log(`[Remind] Scheduled retry for ${user.tag} in ${reminderConfig.retryDelayMinutes} minutes`);
            await remindDB.set(reminder.id, reminder);
          }
        }
      } catch (error) {
        console.error(`[Remind] Error processing reminder ${reminder.id}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('[Remind] Error in reminder checker:', error.message);
  }
}

// Load any active giveaways from the database
async function restoreGiveaways(client) {
  try {
    const DatabaseManager = require('./Functions/MySQLDatabaseManager');
    const giveawayDB = DatabaseManager.getGiveawaysDB();
    
    const allGiveaways = Object.values(await giveawayDB.all());
    let restored = 0;
    let invalid = 0;
    
    if (!allGiveaways || allGiveaways.length === 0) {
      return;
    }
    
    for (const giveaway of allGiveaways) {
      if (!giveaway || giveaway.completed) continue;
      
      // Validate giveaway data - MUST have all required fields
      if (!giveaway.channelId || !giveaway.messageId || !giveaway.endTime || !giveaway.prize) {
        console.log(`[Giveaway] Invalid giveaway data, cleaning up: ${JSON.stringify(giveaway)}`);
        // DELETE invalid giveaway from database to prevent accumulation
        try {
          await giveawayDB.delete(giveaway.id || giveaway.messageId);
          invalid++;
        } catch (deleteErr) {
          console.error(`[Giveaway] Failed to delete invalid entry: ${deleteErr.message}`);
        }
        continue;
      }
      
      try {
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel) continue;
        
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message) continue;
        
        // Calculate remaining time
        const timeRemaining = Math.max(0, giveaway.endTime - Date.now());
        
        // If giveaway has already ended, finalize it
        if (timeRemaining === 0) {
          await finalizeGiveawayFromDB(message, giveaway, client);
          restored++;
          continue;
        }
        
        // Resume countdown for giveaway
        const durationInSeconds = Math.ceil(timeRemaining / 1000);
        runGiveawayCountdown(message, giveaway.messageId, client, durationInSeconds, giveaway.prize, giveaway.hostName);
        restored++;
        console.log(`[Giveaway] ${giveaway.prize} - ${Math.ceil(timeRemaining / 1000)}s left`);
      } catch (error) {
        console.error(`[Giveaway] Couldn't restore ${giveaway.messageId}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('[Giveaway] Error in giveaway restoration:', error.message);
  }
}

// End a giveaway that ended while bot was offline
async function finalizeGiveawayFromDB(message, giveaway, client) {
  try {
    let participants = [];
    
    // Check if message and reactions exist
    if (message && message.reactions && message.reactions.cache) {
      const reaction = message.reactions.cache.get('🎉');
      
      if (reaction) {
        try {
          const users = await reaction.users.fetch();
          participants = users.filter(user => !user.bot).map(user => user.username);
        } catch (err) {
          console.error('[Giveaway] Could not fetch reaction users:', err.message);
        }
      }
    } else {
      console.warn('[Giveaway] Message reactions not available for finalization');
    }

    // Check if message is valid and has edit method
    if (!message || typeof message.edit !== 'function') {
      console.warn('[Giveaway] Cannot finalize - message object is invalid or missing edit method');
      
      // Mark as completed anyway to prevent retry loops - but don't try to save if we don't have valid data
      if (giveaway && (giveaway.messageId || giveaway.id)) {
        try {
          const DatabaseManager = require('./Functions/MySQLDatabaseManager');
          const giveawayDB = DatabaseManager.getGiveawaysDB();
          giveaway.completed = true;
          giveaway.ended = true;
          const giveawayId = giveaway.id || giveaway.messageId;
          await giveawayDB.set(giveawayId, giveaway);
        } catch (err) {
          console.error('[Giveaway] Could not mark as completed:', err.message);
        }
      }
      return;
    }

    let endEmbed;

    if (participants.length === 0) {
      endEmbed = {
        color: 16744171,
        title: '❌ No Winners',
        description: `━━━━━━━━━━━━━━━━━━━━━\n\nUnfortunately, nobody reacted to the **${giveaway.prize}** giveaway.\n\n**Better luck next time!** 🍀\n\n━━━━━━━━━━━━━━━━━━━━━`,
        fields: [
          { name: '🎁 Prize', value: `**${giveaway.prize}**`, inline: true },
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
        description: `━━━━━━━━━━━━━━━━━━━━━\n\n🎉 **Congratulations ${winner}!** 🎉\n\nYou have won the **${giveaway.prize}** giveaway!\n\n━━━━━━━━━━━━━━━━━━━━━`,
        fields: [
          { name: '🎁 Prize Won', value: `**${giveaway.prize}**`, inline: true },
          { name: '🥇 Winner', value: `**${winner}**`, inline: true },
          { name: '👥 Total Participants', value: `**${participants.length}**`, inline: true },
          { name: '📊 Winning Chance', value: `**${((1 / participants.length) * 100).toFixed(2)}%**`, inline: true }
        ],
        footer: { text: '🎊 Giveaway Ended - Congratulations to the winner!' },
        timestamp: new Date()
      };
    }

    await message.edit({ embeds: [endEmbed] }).catch((err) => {
      console.error(`[Giveaway] Failed to update end embed: ${err.message}`);
    });

    // Mark as completed in database
    try {
      const DatabaseManager = require('./Functions/MySQLDatabaseManager');
      const giveawayDB = DatabaseManager.getGiveawaysDB();
      giveaway.completed = true;
      giveaway.ended = true;
      const giveawayId = giveaway.id || giveaway.messageId;
      
      if (giveawayId) {
        await giveawayDB.set(giveawayId, giveaway);
      } else {
        console.warn('[Giveaway] Cannot save - no valid ID found');
      }
    } catch (err) {
      console.error('[Giveaway] Error saving completed status:', err.message);
    }

  } catch (error) {
    console.error('[Giveaway] Error finalizing restored giveaway:', error.message);
  }
}

// Update giveaway message as time counts down
async function runGiveawayCountdown(message, giveawayId, client, duration, prize, host) {
  let timeRemaining = duration;
  const updateInterval = Math.min(30, Math.max(5, Math.floor(duration / 10)));

  while (timeRemaining > 0) {
    await sleep(updateInterval * 1000);
    timeRemaining -= updateInterval;

    try {
      const reaction = message.reactions.cache.get('🎉');
      const participantCount = reaction ? reaction.count - 1 : 0;

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

      await message.edit({ embeds: [countdownEmbed] }).catch((err) => {
        console.error(`[Giveaway] Failed to update countdown: ${err.message}`);
      });
    } catch (error) {
      console.error('Error updating giveaway:', error);
    }
  }

  // Giveaway ended
  await finalizeGiveaway(message, giveawayId, client, prize, host);
}

// Convert seconds to readable time
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Pick winner and update giveaway message
async function finalizeGiveaway(message, giveawayId, client, prize, host) {
  try {
    const reaction = await message.reactions.cache.get('🎉');
    const users = reaction ? await reaction.users.fetch() : new Map();
    
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

    await message.edit({ embeds: [endEmbed] }).catch((err) => {
      console.error(`[Giveaway] Failed to update end embed: ${err.message}`);
    });

    // Mark as completed in database
    const DatabaseManager = require('./Functions/MySQLDatabaseManager');
    const giveawayDB = DatabaseManager.getGiveawaysDB();
    const giveaway = await giveawayDB.get(giveawayId);
    if (giveaway) {
      giveaway.completed = true;
      await giveawayDB.set(giveawayId, giveaway);
    }

  } catch (error) {
    console.error('Error finalizing giveaway:', error);
  }
}

// Interaction handler for slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);

  if (!command) {
    console.warn(`⚠️  No command matching /${interaction.commandName} was found.`);
    return;
  }

  // Rate limiting
  const RateLimiter = require('./Functions/RateLimiter');
  const { administratorRoleId, moderatorRoleId } = require('./Config/constants/roles.json');
  const DatabaseManager = require('./Functions/MySQLDatabaseManager');

  // Role + permission checks for moderation/management commands
  const category = command.category || 'uncategorized';
  const member = interaction.member;

  const logInteraction = async (status, errorMessage = null) => {
    try {
      await DatabaseManager.logUserInteraction({
        userId: interaction.user?.id,
        username: interaction.user?.username,
        commandName: interaction.commandName,
        commandCategory: category,
        guildId: interaction.guild?.id,
        channelId: interaction.channelId,
        status,
        errorMessage
      });
    } catch (err) {
      // Avoid blocking command flow on logging issues
    }
  };
  if (category === 'moderation' || category === 'management') {
    const hasModeratorRole = member?.roles?.cache?.has(moderatorRoleId);
    const hasAdminRole = member?.roles?.cache?.has(administratorRoleId);
    const hasModeratePermission = member?.permissions?.has('ModerateMembers');
    const hasAdminPermission = member?.permissions?.has('Administrator');

    const roleAllowed = category === 'management' ? hasAdminRole : (hasAdminRole || hasModeratorRole);
    const permissionAllowed = category === 'management' ? hasAdminPermission : (hasAdminPermission || hasModeratePermission);

    if (!roleAllowed || !permissionAllowed) {
      await logInteraction('PERMISSION', 'Missing required role or permissions');
      return interaction.reply({
        content: '❌ You do not have the required role and permissions for this command.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
  
  // Check if user is exempt (admins/mods)
  const isExempt = RateLimiter.isExempt(interaction.member, [administratorRoleId, moderatorRoleId]);
  
  if (!isExempt) {
    const rateLimit = RateLimiter.checkLimit(interaction.user.id, interaction.commandName);
    
    if (rateLimit.limited) {
      const errorMessage = rateLimit.type === 'global'
        ? `⏱️ You're using commands too quickly! Please wait **${rateLimit.retryAfter}s** before trying again.`
        : `⏱️ You're using this command too quickly! Please wait **${rateLimit.retryAfter}s** before using \`/${interaction.commandName}\` again.`;
      
      await logInteraction('RATE_LIMIT', errorMessage);
      return interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
    
    // Record usage
    RateLimiter.recordUsage(interaction.user.id, interaction.commandName);
  }

  try {
    await command.execute(interaction);
    await logInteraction('SUCCESS');
  } catch (error) {
    console.error(`❌ Error executing command /${interaction.commandName}:`, error.message);
    await logInteraction('ERROR', error.message);
    await sendCommandErrorResponse(interaction);
  }
});

// Validate required environment variables
function validateEnvironment() {
  const required = {
    'TOKEN': 'Discord Bot Token',
    'CLIENT_ID': 'Discord Application ID',
    'GUILD_ID': 'Discord Server ID'
  };
  
  const missing = [];
  const empty = [];
  
  for (const [key, description] of Object.entries(required)) {
    if (!(key in process.env)) {
      missing.push(`${key} (${description})`);
    } else if (!process.env[key] || process.env[key].trim() === '') {
      empty.push(`${key} (${description})`);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(item => console.error(`   - ${item}`));
    console.error('\n📖 Please configure these in Config/credentials.env\n');
    process.exit(1);
  }
  
  if (empty.length > 0) {
    console.error('❌ Empty environment variables (must have values):');
    empty.forEach(item => console.error(`   - ${item}`));
    console.error('\n📖 Please add values in Config/credentials.env\n');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables configured\n');
}

client.once("clientReady", () => {
  client.emit("commandsAndEventsLoaded", 1);
  
  // Update bot stats immediately and then every 30 seconds
  const updateBotStats = () => {
    try {
      const guildCount = client.guilds.cache.size;
      let totalMembers = 0;
      let botMembers = 0;
      
      // Count total members and bots
      client.guilds.cache.forEach(guild => {
        totalMembers += guild.memberCount;
        // Count bots in this guild
        guild.members.cache.forEach(member => {
          if (member.user.bot) botMembers++;
        });
      });
      
      const totalRoles = client.guilds.cache.reduce((acc, guild) => acc + guild.roles.cache.size, 0);
      const totalChannels = client.guilds.cache.reduce((acc, guild) => acc + guild.channels.cache.size, 0);
      const totalEmojis = client.guilds.cache.reduce((acc, guild) => acc + guild.emojis.cache.size, 0);
      
      updateStats({
        uptime: Math.floor(client.uptime / 1000), // Convert to seconds
        guildCount: guildCount,
        totalMembers: totalMembers,
        botMembers: botMembers,
        totalRoles: totalRoles,
        totalChannels: totalChannels,
        totalEmojis: totalEmojis,
        commandsLoaded: client.slashCommands.size,
        eventsLoaded: eventLoader.getEventCount()
      });
    } catch (err) {
      console.error('Error updating bot stats:', err.message);
    }
  };
  
  // Update immediately on ready
  updateBotStats();
  
  // Then update every 30 seconds
  setInterval(updateBotStats, 30000);
});

client.on('error', (err) => {
  console.error('❌ Client error:', err.message);
});
client.on('warn', (msg) => {
  console.warn('⚠️  Client warn:', msg);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await client.destroy();
  process.exit(0);
});

// Start everything
(async () => {
  try {
    validateEnvironment();
    await initializeBot();
    client.login(process.env.TOKEN);
    
    // Start admin panel if enabled
    if (process.env.ENABLE_ADMIN_PANEL !== 'false') {
      try {
        const adminPanel = require('./adminPanel');
        if (typeof adminPanel.setDiscordClient === 'function') {
          adminPanel.setDiscordClient(client);
        }
        console.log('🎛️  Admin Panel: Enabled');
      } catch (err) {
        console.warn('⚠️  Admin panel could not start:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Fatal error during startup:', err.message);
    process.exit(1);
  }
})();