const { resolve } = require("path");
const { readdir } = require("fs").promises;
const { Collection } = require("discord.js");

async function * getFiles(dir) {
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

async function load(collection) {
	let commandCount = 0;
	let errorCount = 0;
	const categories = new Map();
	
	console.log('\n🎮 Loading Commands...');
	
	for await (const fn of getFiles("./Commands")) {
		if (fn.endsWith("_loader.js") || fn.endsWith("_slashLoader.js")) continue;
		
		try {
			const command = require(fn);
			if (command.data) {
				collection.set(command.data.name, command);
				
				const category = command.category || 'uncategorized';
				if (!categories.has(category)) {
					categories.set(category, []);
				}
				categories.get(category).push(command.data.name);
				
				commandCount++;
				console.log(`  ✅ /${command.data.name} (${category})`);
			}
		} catch (err) {
			errorCount++;
			console.error(`  ❌ Error loading command from ${fn}: ${err.message}`);
		}
	}
	
	console.log('\n📊 Command Summary:');
	console.log(`  ├─ Total Commands: ${commandCount}${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
	console.log(`  ├─ Categories: ${categories.size}`);
	
	let categoryIndex = 1;
	const categoryArray = Array.from(categories.entries());
	categoryArray.forEach(([category, commands], index) => {
		const isLast = index === categoryArray.length - 1;
		const prefix = isLast ? '  └─' : '  ├─';
		console.log(`${prefix} ${category}: ${commands.length}`);
	});
	
	console.log('\n✨ Commands loaded\n');
}

module.exports = load;