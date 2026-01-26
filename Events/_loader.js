const { resolve } = require("path");
const { readdir } = require("fs").promises;

async function * getFiles(dir) { // recursively find all event files
	const dirents = await readdir(dir, { withFileTypes: true });
	for (const dirent of dirents) {
		const res = resolve(dir, dirent.name);
		if (dirent.isDirectory()) {
			yield * getFiles(res);
		} else {
			yield res;
		}
	}
}

async function load(client) {
	let eventCount = 0;
	let errorCount = 0;
	const eventNames = [];
	
	console.log('\n📡 Loading Events...');
	
	for await (const fn of getFiles("./Events")) {
		if (fn.endsWith("_loader.js")) continue; // do not load event loader as event
		
		try {
			const event = require(fn);
			
			// Skip files that don't have event properties
			if (!event.name || (!event.call && !event.execute)) {
				continue;
			}
			
			// Support both 'call' and 'execute' patterns
			let handler;
			if (event.call) {
			// 'call' pattern: call(client, args) where args is an array
			handler = (...args) => event.call(client, args);
			}
			
			if (event.runOnce) {
				client.once(event.name, handler);
			} else {
				client.on(event.name, handler);
			}
			
			eventCount++;
			eventNames.push(`${event.name}${event.runOnce ? ' (once)' : ''}`);
			console.log(`  ✅ ${event.name} ${event.runOnce ? '(once)' : ''}`);
		} catch (err) {
			errorCount++;
			console.error(`  ❌ Error loading event: ${err.message}`);
		}
	}
	
	console.log(`\n✨ Events loaded: ${eventCount}${errorCount > 0 ? ` (${errorCount} errors)` : ''}\n`);
}

module.exports = load;