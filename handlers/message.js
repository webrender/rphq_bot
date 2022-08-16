import moment from "moment-timezone";
import {
    createRoleplayLog,
    getCharactersWritten,
    getAllGuilds,
    getGuildInfo,
    getActions,
} from "../dataAccessors.js";
import {
    hasRoleplay,
    stripTupperReplies,
    getUids,
    getWebhook,
    updateColor,
    checkRestrictions,
    doReactions,
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
            const cw = await getCharactersWritten(message.author.id);
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

            if (message.author.bot) {
                await processRPFromBot(
                    text,
                    message,
                    client,
                    pendingBotMessages
                );
            } else {
                await processRPFromUser(text, message, client);
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
            } else {
                // this replicates tupper-like functionality to post messages on behalf of the bot
                if (!isNaN(parseInt(message.content.split(" ")[0]))) {
                    const channelId = message.content.split(" ")[0];
                    const channel = await client.channels.fetch(channelId);
                    const { guildId } = channel;
                    const guildInfo = await getGuildInfo(guildId);
                    const webhook = await getWebhook(
                        client,
                        guildInfo,
                        channel
                    );
                    const msg = message.content.split(" ").splice(1).join(" ");
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

const processRPFromBot = async (
    trimmedText,
    message,
    client,
    pendingBotMessages
) => {
    const text = stripTupperReplies(trimmedText);
    pendingBotMessages.push({
        id: message.id,
        text,
        timestamp: moment().unix(),
    });
};

const processRPFromUser = async (trimmedText, message) => {
    // tupperbox splits messages at 1997 characters to deal with the nitro limit
    // and so will we
    const stringArray = trimmedText.match(/[\s\S]{1,1997}/g);
    if (stringArray) {
        await Promise.all(
            stringArray.map(async (s) => {
                // write each snippet to the DB
                createRoleplayLog({
                    messageId: message.id,
                    userId: message.author.id,
                    length: s.length,
                    createdAt: moment(message.createdTimestamp).utc(),
                    channelId: message.channelId,
                });
            })
        );
    }
};

export { newMessage };
