// Gets a member from a mention, ID, or username.
// Handles different input formats like <@123>, 123456, or username.
// Makes commands more flexible for users.

async function getMemberFromMention(guild, input) {
    if (!guild) {
        throw new Error('Guild is required');
    }
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
        return null;
    }

    const trimmedInput = input.trim();

    // Try to match mention format: <@!123456> or <@123456>
    const mentionMatch = trimmedInput.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        const id = mentionMatch[1];
        try {
            return await guild.members.fetch(id);
        } catch (err) {
            return null;
        }
    }

    // Try raw ID (should be 18-20 digits).
    if (/^\d{18,20}$/.test(trimmedInput)) {
        try {
            return await guild.members.fetch(trimmedInput);
        } catch (err) {
            return null;
        }
    }

    // Try exact username or display name match (case-insensitive).
    const lowerInput = trimmedInput.toLowerCase();
    let member = guild.members.cache.find(m => 
        m.user.username.toLowerCase() === lowerInput ||
        m.displayName.toLowerCase() === lowerInput
    );

    if (member) return member;

    // Try fuzzy search if input is at least 3 characters (so we don't match too broadly).
    if (trimmedInput.length >= 3) {
        member = guild.members.cache.find(m =>
            m.user.username.toLowerCase().includes(lowerInput) ||
            m.displayName.toLowerCase().includes(lowerInput)
        );
        
        if (member) {
            console.log(`[GetMemberFromMention] Fuzzy match: '${trimmedInput}' matched member ${member.user.tag}`);
            return member;
        }
    }

    return null;
}

// Get user from mention or ID
async function getUserFromInput(client, input) {
    if (!client) {
        throw new Error('Client is required');
    }
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
        return null;
    }

    const trimmedInput = input.trim();

    // Try mention format
    const mentionMatch = trimmedInput.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        try {
            return await client.users.fetch(mentionMatch[1]);
        } catch (err) {
            return null;
        }
    }

    // Try raw ID (must be 18-20 digits)
    if (/^\d{18,20}$/.test(trimmedInput)) {
        try {
            return await client.users.fetch(trimmedInput);
        } catch (err) {
            return null;
        }
    }

    return null;
}

// Check if member has a role
function memberHasRole(member, roleInput) {
    if (!member) return false;
    
    const roleId = typeof roleInput === 'string' ? roleInput : roleInput?.id;
    return member.roles.cache.has(roleId);
}

// Get all members with a role
function getMembersWithRole(guild, roleInput) {
    if (!guild) {
        throw new Error('Guild is required');
    }
    
    const roleId = typeof roleInput === 'string' ? roleInput : roleInput?.id;
    return guild.members.cache.filter(m => m.roles.cache.has(roleId));
}

// Add role to a member
async function addRoleToMember(member, roleInput, reason = 'No reason provided') {
    if (!member) return null;
    
    try {
        const role = typeof roleInput === 'string' ? member.guild.roles.cache.get(roleInput) : roleInput;
        if (!role) return null;
        
        await member.roles.add(role, reason);
        return member;
    } catch (err) {
        console.error(`Failed to add role to member: ${err.message}`);
        return null;
    }
}

// Remove role from a member
async function removeRoleFromMember(member, roleInput, reason = 'No reason provided') {
    if (!member) return null;
    
    try {
        const role = typeof roleInput === 'string' ? member.guild.roles.cache.get(roleInput) : roleInput;
        if (!role) return null;
        
        await member.roles.remove(role, reason);
        return member;
    } catch (err) {
        console.error(`Failed to remove role from member: ${err.message}`);
        return null;
    }
}

// Check if a member has elevated permissions in the guild
function isModOrAdmin(member) {
    if (!member) return false;
    return member.permissions.has('ModerateMembers') || member.permissions.has('Administrator');
}

module.exports = {
    getMemberFromMention,
    getUserFromInput,
    memberHasRole,
    getMembersWithRole,
    addRoleToMember,
    removeRoleFromMember,
    isModOrAdmin
};