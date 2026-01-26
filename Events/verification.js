const fs = require('fs');
const { Canvas, loadImage } = require('skia-canvas');
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const path = require('path');
const { CaptchaGenerator } = require("captcha-canvas");
const { roleID, AdminRole } = require("../Config/constants/roles.json");
const { welcomeChannel, verificationchannel, captchalogchannel } = require("../Config/constants/channel.json");
const { Version } = require("../Config/main.json");

const Color = "#32CD32"; // Default verification accent color

module.exports = {
    name: "guildMemberAdd",
    runOnce: false,
    call: async (client, args) => {
        const userCaptchaData = {};
        if (!args || !args[0]) return;
        const member = args[0];
        const captchachannel = client.channels.cache.get(captchalogchannel);
        const verifyChannel = client.channels.cache.get(verificationchannel);
        const welcomeChannelObj = client.channels.cache.get(welcomeChannel);

        if (!member || !client.users.cache.get(member.id).bot === false) return;

        // Auto-verify bots
        if (client.users.cache.get(member.id).bot) {
            const roleObj = member.guild.roles.cache.get(roleID);
            if (roleObj) {
                return member.roles.add(roleObj);
            }
            return;
        }

        // Human verification
        const captcha = new CaptchaGenerator()
            .setDimension(600, 600)
            .setCaptcha({ 
                text: Math.random().toString(36).substring(2, 8).toUpperCase(), 
                size: 70, 
                color: "#32CD32" 
            })
            .setDecoy({ opacity: 0.2 })
            .setTrace({ color: "#32CD32", size: 2 });

        const captchaBuffer = await captcha.generate();
        const captchaCode = captcha.text;
        
        console.log(`Generated captcha for ${member.user.tag}: ${captchaCode}`);

        if (!captchachannel) {
            const systemErrorEmbed = new EmbedBuilder()
                .setColor(0xF04747)
                .setTitle('❌ Verification System Error')
                .setDescription(`Sorry, the verification system failed. Please contact an <@&${AdminRole}> ASAP.`);
            
            return member.send({ embeds: [systemErrorEmbed] }).catch(() => {});
        }

        try {
            const captchaMessage = await captchachannel.send({ 
                files: [new AttachmentBuilder(captchaBuffer, { name: "captcha.png" })] 
            });
            const captchaImage = captchaMessage.attachments.first();
            const Server = member.guild.name;

            const e0 = new EmbedBuilder()
                .setTitle(`🔐 Verification Required`)
                .setColor(Color)
                .setFooter({ text: `${Version}` });

            const e1 = new EmbedBuilder(e0)
                .setAuthor({ name: `${Server} Verification System`, iconURL: member.guild.iconURL() })
                .setDescription(`👋 **Welcome to ${Server}!**\n\n━━━━━━━━━━━━━━━━━━━━━\n\nTo ensure our server's security and keep out automated bots, we need you to complete a quick verification.\n\n✅ **Please enter the captcha code shown in the image below.**`)
                .addFields(
                    { name: `📝 How to Verify`, value: `> Type the **6-character code** from the image\n> Send it as a message in this DM\n> You have **10 minutes** to complete this`, inline: false },
                    { name: `🔄 Need a New Code?`, value: `> Go to the verification channel\n> Run the \`/verify\` command\n> A fresh captcha will be sent to you`, inline: false },
                    { name: `⚠️ Having Trouble?`, value: `> Make sure you can receive DMs from server members\n> Check that you typed the code exactly as shown\n> The code is **case-insensitive**`, inline: false }
                )
                .setTimestamp();

            const e2 = new EmbedBuilder(e0)
                .setColor('#FF0000')
                .setDescription(`❌ **Incorrect Captcha Code**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ The code you entered doesn't match the image.\n\n**Please try again:**\n> Double-check the image above\n> Make sure you typed all 6 characters\n> The code is case-insensitive`);
            const e3 = new EmbedBuilder(e0).setDescription(`✅ **Verification Successful!**\n\nYou have successfully verified your identity in **${Server}** and have been assigned the <@&${roleID}> role.\n\n🎉 You now have full access to the server!`).setColor("#00FF00");

            userCaptchaData[member.id] = { captchaValue: captchaCode };

            const dmChannel = member.user.dmChannel || await member.user.createDM();
            
            // Always ping user in verification channel first
            if (verifyChannel) {
                const verifyEmbed = new EmbedBuilder()
                    .setAuthor({ name: `${Server} Security`, iconURL: member.guild.iconURL() })
                    .setTitle(`🔐 Verification Required`)
                    .setColor(Color)
                    .setDescription(`👋 **Welcome ${member}!**\n\n━━━━━━━━━━━━━━━━━━━━━\n\nBefore you can access the server, we need to verify that you're a real person and not a bot.\n\n**This is quick and easy!**`)
                    .addFields(
                        { name: '📝 How to Get Verified', value: '```1️⃣ Run the /verify command below\n2️⃣ Check your DMs for a captcha image\n3️⃣ Type the code from the image\n4️⃣ Get instant access!```', inline: false },
                        { name: '⚠️ Important Notes', value: '> 🔓 **Enable DMs** from server members\n> ⏱️ You have **10 minutes** to complete\n> 🔄 Can\'t read it? Just run `/verify` again', inline: false },
                        { name: '❓ Need Help?', value: 'If you\'re having trouble, check that:\n• Your DMs are open\n• You\'re typing the code exactly as shown\n• You\'re using the latest captcha', inline: false }
                    )
                    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                    .setImage('https://i.imgur.com/sEkQOCf.png')
                    .setTimestamp()
                    .setFooter({ text: '🛡️ Verification keeps our community safe and spam-free' });
                
                verifyChannel.send({ content: `${member}`, embeds: [verifyEmbed] })
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 60000)); // Delete after 1 minute
            }

            // Still try to send DM for immediate verification (legacy support)
            dmChannel.send({
                embeds: [e1.setImage(captchaImage.url)]
            }).catch(async () => {
                // DM failed - user already pinged in verification channel above
                console.log(`Could not DM ${member.user.tag} - they need to use /verify command`);
            });

            const filter = m => {
                if (m.author.bot) return false;
                if (m.author.id === member.id) {
                    const userInput = String(m.content).toUpperCase().trim();
                    const correctCode = String(userCaptchaData[member.id].captchaValue).toUpperCase().trim();
                    console.log(`User ${member.user.tag} entered: "${userInput}", Expected: "${correctCode}"`);
                    if (userInput === correctCode) {
                        return true;
                    } else {
                        m.channel.send({ embeds: [e2] }).catch(err => console.error('Error sending incorrect message:', err));
                        return false;
                    }
                }
                return false;
            };

            dmChannel.awaitMessages({
                filter,
                max: 1,
                time: 600000,
            }).then(async response => {
                try {
                    console.log(`Response received for ${member.user.tag}, size: ${response.size}`);
                    if (response && response.size > 0) {
                        const roleObj = member.guild.roles.cache.get(roleID);
                        console.log(`Role found: ${roleObj ? roleObj.name : 'NULL'}`);
                        if (roleObj) {
                            await member.roles.add(roleObj);
                            console.log(`Role added to ${member.user.tag}`);
                            
                            // Send success message with actual role name
                            const successEmbed = new EmbedBuilder()
                                .setAuthor({ name: `${Server} Verification System`, iconURL: member.guild.iconURL() })
                                .setTitle(`✅ Verification Complete!`)
                                .setColor("#00FF00")
                                .setDescription(`🎉 **Welcome to ${Server}!**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n✅ You have successfully verified your account!\n\n**What happened:**\n> 🎭 Role assigned: **${roleObj.name}**\n> 🔓 Full server access granted\n> 👋 Welcome message sent\n\n**You can now:**\n• View all channels\n• Chat with members\n• Participate in events\n• Enjoy the community!`)
                                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                                .setFooter({ text: `${Version} • Thanks for verifying!` })
                                .setTimestamp();
                            
                            await dmChannel.send({ embeds: [successEmbed] });

                            // Create welcome canvas
                            const canvas = new Canvas(700, 250);
                            const ctx = canvas.getContext('2d');
                            const bgPath = path.join(__dirname, '../Images/background.png');
                            console.log('Verification background path:', bgPath);
                            
                            // Load background from file
                            const background = await loadImage(bgPath);
                            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                            ctx.strokeStyle = '#74037b';
                            ctx.strokeRect(0, 0, canvas.width, canvas.height);

                            ctx.font = '28px sans-serif';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText('Welcome to the server,', canvas.width / 2.5, canvas.height / 3.5);

                            ctx.font = '32px sans-serif';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(`${member.displayName}!`, canvas.width / 2.5, canvas.height / 1.8);

                            // Reset clipping and draw avatar
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
                            ctx.closePath();
                            ctx.clip();

                            // Get avatar URL with extension
                            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
                            const avatar = await loadImage(avatarURL);
                            ctx.drawImage(avatar, 25, 25, 200, 200);
                            ctx.restore();

                            const attachment = new AttachmentBuilder(await canvas.toBuffer('png'), { name: 'welcome-image.png' });

                            if (welcomeChannelObj) {
                                welcomeChannelObj.send({ 
                                    content: `Welcome ${member} to the server!`, 
                                    files: [attachment] 
                                });
                            }

                            // Log verification
                            const CaptchaLog = new EmbedBuilder()
                                .setAuthor({ name: 'Member Verification Log', iconURL: member.user.displayAvatarURL() })
                                .setTitle(`✅ New Member Verified`)
                                .setDescription(`${member} has successfully completed verification.`)
                                .addFields(
                                    { name: `👤 User`, value: `${member.user.username}\n\`${member.id}\``, inline: true },
                                    { name: `📅 Joined Server`, value: `${member.joinedAt.toDateString()}`, inline: true },
                                    { name: `🎭 Role Given`, value: `${roleObj}`, inline: true },
                                    { name: `📆 Account Created`, value: `${member.user.createdAt.toDateString()}`, inline: true },
                                    { name: `🔑 Captcha Code`, value: `\`${userCaptchaData[member.id].captchaValue}\``, inline: true },
                                    { name: `⏱️ Account Age`, value: `${Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))} days`, inline: true }
                                )
                                .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                                .setColor('#00FF00')
                                .setTimestamp();

                            if (captchachannel) captchachannel.send({ embeds: [CaptchaLog] });
                        }
                    }
                } catch (err) {
                    console.log(err);
                }
            }).catch(async () => {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFAA61A)
                    .setTitle('⏱️ Timeout')
                    .setDescription('Operation timed out. Please run `/verify` to try again.');
                
                dmChannel.send({ embeds: [timeoutEmbed] }).catch(() => {});
            });

        } catch (err) {
            console.log(err);
        }
    }
};