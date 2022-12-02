import moment from "moment-timezone";
import { EmbedBuilder } from "discord.js";
import {
    getCharactersWritten,
    getAllGuilds,
    getGuildInfo,
    getActions,
    getAchievements,
} from "../dataAccessors.js";
import {
    hasRoleplay,
    getUids,
    getWebhook,
    updateColor,
    checkRestrictions,
    doReactions,
    grantAchievement,
} from "../logic.js";

const newMessage = async (message, client, pendingBotMessages) => {
    if (message.author.id == client.user.id) {
        return;
    }
    if (message.guild) {
        const text = message.content.trim();
        // see if this is a message in a roleplay channel
        const isRoleplay = await hasRoleplay(message);
        let roleplayData;

        if (isRoleplay) {
            const cw = await getCharactersWritten(
                message.author.id,
                message.guildId
            );
            const cwsum = cw.reduce(
                (sum, a) => sum + parseInt(a.charactersWritten),
                0
            );
            const cwsumMonth = cw.reduce((sum, a) => {
                const monthsAgo = moment
                    .duration(moment().diff(a.minDate))
                    .asMonths();
                if (monthsAgo <= 1) {
                    return sum + parseInt(a.charactersWritten);
                }
                return sum;
            }, 0);

            const charactersWritten = cwsum;
            roleplayData = {
                charactersWritten,
                cwsumMonth,
            };

            if (!message.author.bot) {
                await updateColor(
                    message.member,
                    charactersWritten,
                    message.guildId
                );
            }
        }
        const actions = await getActions("message", message.guild.id);
        actions.forEach(async (action) => {
            if (
                !action.restrictions ||
                (await checkRestrictions({
                    client,
                    member: message.member || { user: message.author },
                    object: { message },
                    restrictions: JSON.parse(action.restrictions),
                    roleplayData,
                }))
            ) {
                await doReactions({
                    guildId: message.guild.id,
                    client,
                    member: message.member,
                    message,
                    mentions: getUids(text),
                    reactions: JSON.parse(action.reaction),
                    roleplayData,
                });
            }
        });
    } else {
        if (message.author.id === "840393634272772116") {
            if (message.content === "clearCache") {
                global.actionsCache = {};
                global.categoryCache = {};
                global.characterCache = {};
            } else {
                const splitMessage = message.content.split(" ");
                if (splitMessage[0] === "listAchievements") {
                    const guildId = splitMessage[1];
                    if (!isNaN(parseInt(guildId))) {
                        const achievements = await getAchievements(true);
                        const achArray = await Promise.all(
                            achievements.map(async (a) => {
                                const guild = await client.guilds.fetch(
                                    guildId
                                );
                                const role = await guild.roles.fetch(a.roleId);
                                return { ...a, name: role.name };
                            })
                        );
                        const str = achArray
                            .sort((a, b) => (a.name > b.name ? 1 : -1))
                            .map((a) => `${a.id}: **${a.name}**`);
                        const embed = new EmbedBuilder()
                            .setColor("#F1C30E")
                            .setTitle("Achievements")
                            .setDescription(
                                str.length > 0 ? str.join("\n") : ""
                            );
                        message.reply({ embeds: [embed] });
                    }
                } else if (splitMessage[0] === "grantAchievement") {
                    const guildId = splitMessage[1];
                    const userId = splitMessage[2];
                    const achievementId = splitMessage[3];
                    if (
                        !isNaN(guildId) &&
                        !isNaN(userId) &&
                        !isNaN(achievementId)
                    ) {
                        await grantAchievement(
                            achievementId,
                            { id: userId },
                            guildId,
                            message.client
                        );
                    }
                }
                // this replicates tupper-like functionality to post messages on behalf of the bot
                else if (!isNaN(parseInt(splitMessage[0]))) {
                    const channelId = splitMessage[0];
                    const channel = await client.channels.fetch(channelId);
                    const { guildId } = channel;
                    const guildInfo = await getGuildInfo(guildId);
                    const webhook = await getWebhook(
                        client,
                        guildInfo,
                        channel
                    );
                    const msg = splitMessage.splice(1).join(" ");
                    webhook.send(msg).then(() => {
                        message.reply({
                            content: "Echo sent.",
                            ephemeral: true,
                        });
                    });
                } else {
                    const guilds = await getAllGuilds();
                    guilds.forEach(async (guildInfo) => {
                        const webhook = await getWebhook(client, guildInfo);
                        webhook.send(message.content).then(() => {
                            message.reply({
                                content: "Echo sent.",
                                ephemeral: true,
                            });
                        });
                    });
                }
            }
        }
        return;
    }
};

export { newMessage };
