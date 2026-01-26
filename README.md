# 🤖 Discord Bot

Feature-rich Discord moderation and management bot with tickets, verification, giveaways, and comprehensive logging.

---

## 📋 Table of Contents
- Overview
- Features
- Setup
- Commands
- Roadmap
- Known Issues
- Support & Contributing
- License

---

## ⚡ Overview
Aiming to be an all-in-one toolkit for community servers: moderation with case tracking, robust logging, tickets, verification, and quality-of-life utilities. Still evolving, so expect frequent tweaks.

> ⚠️ Under development. Some options are placeholders and will be refined or removed over time.

---

## ✨ Features
- 🛡️ **Moderation**: Ban, kick, and warn users with automatic case tracking and reason logging. View warnings by user or case ID. Clear specific warnings when appropriate.
- 🎫 **Tickets**: User-friendly support ticket system with claim/unclaim functionality, user management, and reaction-based ticket closing. Track all ticket interactions.
- 📊 **Logging**: Comprehensive server logging including member joins/leaves, role changes, channel/emoji creation/deletion, guild updates, and invite tracking.
- ⚙️ **Management**: Server announcements (regular and @everyone), user verification, level/rank management, and giveaway system with automatic winners.
- 🎉 **Giveaways**: Host giveaways with configurable winners, duration, and requirements. Automatic winner selection and notification.
- 📈 **Leveling**: XP-based member progression system with customizable levels and rewards. Leaderboard to view top members.
- 🤖 **Auto-Moderation**: Automatic filter for blocked words and phrases with configurable responses.
- 🎵 **Voice Channels**: "Join to Create" system for dynamic voice channel creation.
- 🎮 **Fun Commands**: 8-ball, trivia, jokes, and polls for community engagement.

---

## 🚀 Setup
1) Install dependencies
```bash
npm install
```
2) Configure the bot (in `/Config`)
- `credentials.env`: Bot token and API keys
- `main.json`: Server settings
- `presence.json`: Bot presence/status
- `constants/`: Channel IDs, role IDs, and other constants
4) Start the bot
```bash
node index.js
```

If configured correctly, the bot should come online. 🎉

---

## 📦 Commands

### Moderation (Moderator role)
| Command | Description |
|---------|-------------|
| `/ban` | Ban a user with reason tracking |
| `/kick` | Kick a user with reason tracking |
| `/warn` | Warn a user with case logging |
| `/clear` | Bulk delete messages (up to 100) |
| `/deletemsg` | Delete a specific message by link |
| `/warning` | View warning details by case ID |
| `/warns` | View all warnings for a user |

### Management (Admin role)
| Command | Description |
|---------|-------------|
| `/announce` | Send a regular announcement |
| `/eannounce` | Send an everyone announcement |
| `/giveaway` | Initiate a timed giveaway with automatic winner selection |
| `/setlevel` | Set a user's XP or level, or reset their progress |
| `/unban` | Unban a user by ID |
| `/clearwarns` | Clear a specific warning by case ID |
| `/checkban` | Look up ban information by case ID |

### Ticket System
| Command | Description |
|---------|-------------|
| `/ticket` | Create a new support ticket |
| `/close` | Close the current ticket |
| `/claim` | Assign ticket to yourself as the primary handler (Support role) |
| `/markhandled` | Mark ticket as handled (Support role) |
| `/adduser` | Add a member to view the ticket |
| `/removeuser` | Remove a member's access from the ticket |

### Leveling & XP
| Command | Description |
|---------|-------------|
| `/rank` | View your or another user's rank and level progress |
| `/leaderboard` | View the server XP leaderboard |

### Fun
| Command | Description |
|---------|-------------|
| `/8ball` | Consult the magic 8-ball for answers to yes/no questions |
| `/trivia` | Challenge your knowledge with a random trivia question |

### Utility
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/userinfo` | Display detailed user information |
| `/serverinfo` | Display comprehensive server statistics and details |
| `/define` | Look up word definitions, phonetics, and usage examples |
| `/joke` | Get a random joke |
| `/poll` | Create an interactive poll with customizable options |
| `/remind` | Schedule a personal reminder via DM |

### Verification
| Command | Description |
|---------|-------------|
| `/verify` | Verify yourself to gain access to the server |

---

## 🗺️ Roadmap
- [x] ~~Server info command~~✅
- [x] ~~Giveaway system~~✅
- [x] ~~"Join to Create" voice channel system~~✅
- [ ] Timeout and un-timeout commands
- [ ] More fun/misc commands
- [ ] Change constant names
- [ ] Fix the welcome/leave notifications
- [ ] Maybe update the automod filter a bit
- [x] ~~Auto-moderation~~✅
- [x] ~~Update command descriptions~~✅
- [x] ~~Unban by case ID & not user ID~~✅
- [x] ~~Compacted config folder~~ ✅
- [x] ~~Checkban command (by case ID)~~ ✅
- [x] ~~Add verify command~~ ✅
- [x] ~~Update embeds~~ ✅
- [x] ~~Fix ticket closing with ❌ reaction~~ ✅
- [x] ~~Fix logging system~~ ✅

---

## 🐞 Known Issues
- Report new bugs with repro steps and screenshots when possible.

---

## 🤝 Support & Contributing
- 🐛 Bugs: Open an issue with steps to reproduce and any errors/logs.
- 💡 Features: Suggest ideas in the Issues tab.
- 🔧 Contributing: Fork, improve, and submit a pull request.

---

## 📝 License
Open source for personal and educational use.

---

**Made with ❤️ for Discord communities**
**Readme.md was made by chatgpt**