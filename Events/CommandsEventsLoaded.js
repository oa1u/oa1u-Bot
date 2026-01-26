module.exports = {
    name: "commandsAndEventsLoaded",
    runOnce: true,
    call: async (client, args) => {
        const commands = client.slashCommands.size;
        const events = client.eventNames().length;
        const categories = new Set();
        
        // Count command categories
        client.slashCommands.forEach(cmd => {
            if (cmd.category) categories.add(cmd.category);
        });
        
        console.log('\n');
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                ║');
        console.log('║          ✅ BOT STARTUP COMPLETE - ALL SYSTEMS ONLINE          ║');
        console.log('║                                                                ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📊 STARTUP STATISTICS:');
        console.log('  ├─ 🎮 Slash Commands:    ' + commands + ' loaded');
        console.log('  ├─ 📡 Event Listeners:   ' + events + ' registered');
        console.log('  ├─ 🏷️  Categories:       ' + categories.size + ' (' + Array.from(categories).join(', ') + ')');
        console.log('  └─ 👤 Bot User:          ' + (client.user?.tag || 'Connecting...'));
        console.log('');
        console.log('🟢 Status: Ready to accept commands');
        console.log('⏰ Timestamp: ' + new Date().toLocaleString());
        console.log('');
    }
};