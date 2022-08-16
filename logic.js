import { EmbedBuilder, PermissionsBitField } from "discord.js";
import got from "got";
import cheerio from "cheerio";
import moment from "moment-timezone";

import {
    getCategories,
    getLeaderboard,
    getRoleplayFilters,
    getAchievements,
    getAchievement,
    createAchievementLog,
    getGuildInfo,
    getColors,
    updateWotd,
    getCooldown,
    updateCooldown,
    getSticky,
    updateSticky,
    getWotd,
    getCounter,
    createCounter,
    updateCounter,
} from "./dataAccessors.js";
import { CLIENT_ID } from "./config.js";

// chunks a messages into several messages under 2000 characters
const chunkMessage = (msg) => {
    if (msg.length <= 2000) {
        // under 2000 characters just return
        return [msg];
    }
    let chunks = []; // the array of chunked messages we will return
    const paragraphs = msg.split("\n"); // start by splitting the message into paragraphs
    paragraphs.forEach((p) => {
        // for each paragraph
        if (p.length <= 2000) {
            // if the paragraph is less than one message long
            if (
                chunks[chunks.length - 1] &&
                (chunks[chunks.length - 1] + p).length <= 2000
            ) {
                // this paragraph fits into the current message chunk, or there's no chunk yet
                chunks[chunks.length - 1] += p; // add this paragraph to the current chunk
            } else {
                // this paragraph doesn't fit to the current message chunk, too large - or there's no chunk yet
                chunks[chunks.length] = p; // create a new chunk and add this paragraph
            }
        } else {
            // this paragraph is over 2000 characters, we need to split it into sentences
            const sentences = p.split("."); // create an array of sentences from this paragraph
            sentences.forEach((s) => {
                // for each sentence
                if (s.length <= 2000) {
                    // if the sentence is less than once message long
                    if (
                        chunks[chunks.length - 1] &&
                        (chunks[chunks.length - 1] + s).length <= 1999
                    ) {
                        // this sentence fits into the current message chunk, or there's no chunk yet
                        chunks[chunks.length - 1] += s + "."; // add this sentence to the current chunk
                    } else {
                        // this sentence doesn't fit into the current chunk, too large - or there's no chunk yet
                        chunks.push(s + "."); // create a new chunk and add this sentence
                    }
                } else {
                    // the sentence is over 2000 characters
                    chunks = chunks.concat(s.match(/.{1,2000}/g)); // just split it at the 2000 character mark
                }
            });
        }
    });
    return chunks;
};

// gets or creates a webhook for sending a tupper-style message
const getWebhook = async (client, guildInfo, ch) => {
    const guild = await client.guilds.fetch(guildInfo.guildId);
    const channel =
        ch || (await guild.channels.fetch(guildInfo.announceChannelId));
    // get the webhooks for this channel
    const webhooks = await channel.fetchWebhooks();
    const webhooksArray = [...webhooks];
    // find the webhook that belongs to us and return it
    const ourWebhook = webhooksArray.find(
        (webhook) => webhook[1].owner.id === client.user.id
    );
    console.log("ourWebhook");
    if (ourWebhook) {
        return ourWebhook[1];
    } else {
        // if there's no webhook yet, create one
        const botClient = await client.users.cache.get(CLIENT_ID);
        const avatar = `https://cdn.discordapp.com/avatars/${botClient.id}/${botClient.avatar}.png`;
        return channel
            .createWebhook({
                name: "Roleplay HQ Bot",
                avatar,
            })
            .then((webhook) => {
                return webhook;
            });
    }
};

// checks if the message is in a roleplay channel
const hasRoleplay = async (message) => {
    // get the list of roleplay filters and see if a given message is in that channel/category
    const roleplayFilters = await getRoleplayFilters();
    let channel = message.channelId;
    let parent = message.channel.parentId;
    if (
        message.type === "GUILD_PUBLIC_THREAD" ||
        message.type === "GUILD_PRIVATE_THREAD"
    ) {
        channel = message.channel.parentId;
        parent = message.channel.parent.parentId;
    }
    const hasFilter = roleplayFilters.find((f) => {
        return channel == f.discordId || parent == f.discordId;
    });
    return Boolean(hasFilter);
};

// generates the leaderboard string
const generateLeaderboard = async (username, label, type, client) => {
    // get the list of leaders from the database
    const leaders = await getLeaderboard(type);
    // take the list of leader IDs, and transform it into an array of strings:
    // 01 Username 1234
    // then take the array and turn it into a single string, with values separated
    // by newlines.
    let leadersOutput = await Promise.all(
        leaders.map(async (l) => {
            const userId = l.dataValues.userId;
            const length = l.dataValues.totalLength;
            const user = await client.users.cache.get(userId);
            if (!user?.username) {
                return;
            }
            return {
                user: user?.username,
                length,
            };
        })
    );
    const filteredLeadersOutput = leadersOutput
        .filter((r) => r?.user)
        .slice(0, 20)
        .map((l, idx) => {
            return `${(idx + 1).toString().padStart(2, "0")} ${l.user}: ${
                l.length
            }`;
        })
        .join("\n");
    // easter egg for Andy
    const leaderboardTitle =
        username === "AndyGargantya" ? "таблица лидеров" : "Leaderboard";
    // return the fully compiled output
    return `**${label} ${leaderboardTitle}**
\`\`\`
${filteredLeadersOutput}
\`\`\``;
};

// strips everything besides the user's text from a tupper message
const stripTupperReplies = (text) => {
    // if the first line is a quote
    if (text.substring(0, 2) === "> ") {
        // split the text into an array of lines
        const textArray = text.split("\n");
        // remove the quote
        textArray.splice(0, 1);
        // check if the second line is an at-tag - tupper does this
        if (textArray[0].substring(0, 2) === "<@") {
            // remove the second line
            textArray.splice(0, 1);
        }
        // re-join the array and return
        return textArray.join("\n");
    }
    return text;
};

// switches the user's active achievement (their badge)
const switchActiveAchievement = async (
    achievementId,
    userId,
    guildId,
    client
) => {
    // get all the achievements
    const achievements = await getAchievements();
    // get all the user's roles
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    const roles = await member.roles.cache.map(({ id, name }) => {
        return { id, name };
    });
    const thisRole = achievements.find((a) => a.id == achievementId);
    // if any of the roles are in the achievement list, remove them
    const achievementIds = achievements.map((a) => a.roleId);
    // const dayAchievements = [DAY_AWARD_ID, DAY_AWARD_ID_2, DAY_AWARD_ID_3];
    roles.forEach(async (r) => {
        if (achievementIds.includes(r.id)) {
            // if (dayAchievements.includes(achievementId)) {
            //     if (r.id !== WEEK_AWARD_ID && r.id !== MONTH_AWARD_ID) {
            //         await member.roles.remove(r.id);
            //     }
            // } else if (achievementId === WEEK_AWARD_ID) {
            //     if (r.id !== MONTH_AWARD_ID) {
            //         await member.roles.remove(r.id);
            //     }
            // } else {
            //     await member.roles.remove(r.id);
            // }
            await member.roles.remove(r.id);
        }
    });
    // add the achievement role
    await member.roles.add(thisRole.roleId);
};

// grants a user an achievement
const grantAchievement = async (
    achievementId,
    user,
    guildId,
    client,
    isMedal
) => {
    // add this achievement to the log
    const logResponse = await createAchievementLog({
        achievementId,
        userId: user.id,
    });

    if (logResponse !== false || isMedal == true) {
        // announce the achievement
        const guild = await client.guilds.fetch(guildId);
        const achievement = await getAchievement(achievementId);
        const role = await guild.roles.fetch(achievement.roleId);
        const guildInfo = await getGuildInfo(guildId);
        const channel = await guild.channels.fetch(guildInfo.announceChannelId);
        let authorField = isMedal
            ? `**Leaderboard Winner! <@${user.id}> has earned the following leaderboard ranking.**`
            : `**Achievement Unlocked! <@${user.id}> has earned an achievement.** You can set achievements as the icon next to your name with the /badge command.`;
        let titleField = `${achievement.icon} ${role.name}`;
        let descriptionField = achievement.description;
        const embed = new EmbedBuilder()
            .setColor("#F1C30E")
            .setTitle(titleField)
            .setDescription(descriptionField);
        await channel.send({ content: authorField, embeds: [embed] });
    }
};

// parses UIDs from a text string
const getUids = (text) => {
    const idRegex = /<@!?([0-9]+)>/gm;
    const hasUserId = text.match(idRegex);
    if (hasUserId) {
        return hasUserId.map((uid) => {
            // sometimes there's a ! in userIds
            if (uid.includes("!")) {
                return uid.substr(3, uid.length - 4);
            }
            return uid.substr(2, uid.length - 3);
        });
    }
    return [];
};

const findCategory = (channelName, categories) => {
    const code = channelName.substr(0, 1).toUpperCase().charCodeAt();
    if (code < 48) {
        return 0;
    }
    if (code > 90) {
        return categories.length - 1;
    }
    console.log(channelName, categories);
    const category = categories.find((c, i) => {
        // console.log(code, c, categories[i + 1]);
        if (!categories[i + 1]) {
            // console.log("next missing");
            return true;
        }
        return (
            code >= c.start.charCodeAt() &&
            code < categories[i + 1].start.charCodeAt()
        );
    });
    // console.log(category);
    return category.categoryId;
};

const getWordOfTheDay = async () => {
    const page = await got.get(
        "https://www.merriam-webster.com/word-of-the-day/"
    );
    const $ = cheerio.load(page.body);

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const word = capitalizeFirstLetter($(".word-and-pronunciation h1").text());
    const def = $(".wod-definition-container > p").text();
    const definition = def.substring(0, def.length - 15).replace("// ", "\n*");
    return { word, definition };
};

const checkRestrictions = async (checkData) => {
    if (checkData.object?.message && checkData.object.message.author.bot) {
        if (!checkData.restrictions.some((r) => r[0] === "allowBot")) {
            return false;
        }
    }
    for (const restriction of checkData.restrictions) {
        const restrictionType = restriction[0];
        if (restrictionType === "userId") {
            if (checkData.member.user.id !== restriction[1]) {
                return false;
            }
        }
        if (restrictionType === "flag") {
            if (
                !checkData.member.permissions ||
                !checkData.member.permissions.has(
                    PermissionsBitField.Flags[restriction[1]]
                )
            ) {
                return false;
            }
        }
        if (restrictionType === "channel") {
            // console.log(checkData.object.message.channelId, restriction[1]);
            if (checkData.object.message.channelId !== restriction[1]) {
                return false;
            }
        }
        if (restrictionType === "firstReact") {
            if (checkData.object.count !== 1) {
                return false;
            }
        }
        if (restrictionType === "contains") {
            if (
                !checkData.object.message.content
                    .toLowerCase()
                    .includes(restriction[1])
            ) {
                return false;
            }
        }
        if (restrictionType === "noSelf") {
            if (
                checkData.object.message.author.id === checkData.member.user.id
            ) {
                return false;
            }
        }
        if (restrictionType === "equals") {
            if (
                checkData.object.message.content.toLowerCase() !==
                restriction[1]
            ) {
                return false;
            }
        }
        if (restrictionType === "equalsExact") {
            if (checkData.object.message.content !== restriction[1]) {
                return false;
            }
        }

        if (restrictionType === "isRoleplay") {
            if (!checkData.roleplayData) {
                return false;
            }
        }

        if (restrictionType === "roleplayWritten") {
            if (checkData.roleplayData?.charactersWritten < restriction[1]) {
                return false;
            }
        }

        if (restrictionType === "roleplayWrittenThisMonth") {
            if (checkData.roleplayData?.cwsumMonth < restriction[1]) {
                return false;
            }
        }

        if (restrictionType === "roleplayType") {
            const categories = await getCategories(
                checkData.object.message.guildId
            );
            const oneOnOneCategories = categories
                .filter((c) => c.type === "one_one" || c.type === "inactive")
                .map((c) => c.categoryId);
            const starterCategories = categories
                .filter((c) => c.type === "starter")
                .map((c) => c.categoryId);

            if (
                restriction[1] === "starter" &&
                !starterCategories.includes(
                    checkData.object.message.channel.parentId
                )
            ) {
                return false;
            }
            if (
                restriction[1] === "one_one" &&
                !oneOnOneCategories.includes(
                    checkData.object.message.channel.parentId
                )
            ) {
                return false;
            }
            if (
                restriction[1] === "group" &&
                (starterCategories.includes(
                    checkData.object.message.channel.parentId
                ) ||
                    oneOnOneCategories.includes(
                        checkData.object.message.channel.parentId
                    ))
            ) {
                return false;
            }
        }
        if (restrictionType === "embedDescriptionContains") {
            if (
                !checkData.object.message.embeds.some((e) =>
                    e.description.includes(restriction[1])
                )
            ) {
                return false;
            }
        }
        if (restrictionType === "minutesSinceGlobalCooldown") {
            const cooldown = await getCooldown(restriction[1], "0");
            if (cooldown) {
                const minutesSinceCooldown = moment
                    .duration(moment().diff(cooldown))
                    .asMinutes();
                if (minutesSinceCooldown > parseInt(restriction[2])) {
                    return false;
                }
            }
        }
        if (restrictionType === "month") {
            if (moment().month() !== parseInt(restriction[1])) {
                return false;
            }
        }
        if (restrictionType === "containsWotd") {
            if (!global.wotd) {
                global.wotd = await getWotd();
            }
            if (
                !checkData.object.message.content
                    .toLowerCase()
                    .includes(global.wotd.toLowerCase()) ||
                checkData.object.message.content.length <= global.wotd.length
            ) {
                return false;
            }
        }
        if (restrictionType === "minutesSinceCounter") {
            const counter = await getCounter(
                restriction[1],
                checkData.object.message.author.id
            );
            if (counter) {
                const minutesSinceLast = moment
                    .duration(moment().diff(counter.updatedAt))
                    .asMinutes();
                if (minutesSinceLast < parseInt(restriction[2])) {
                    return false;
                }
            }
        }
        if (restrictionType === "counterCount") {
            const counter = await getCounter(
                restriction[1],
                checkData.object.message.author.id
            );
            if (
                counter &&
                parseInt(counter.count) !== parseInt(restriction[2])
            ) {
                return false;
            }
        }
    }
    return true;
};

const msgReplace = async (message, payload) => {
    let msg = message;
    if (msg.includes("$username")) {
        msg = msg.replaceAll("$username", payload.member.user.username);
    }
    if (msg.includes("$user")) {
        msg = msg.replaceAll("$user", `${payload.member.user}`);
    }
    if (msg.includes("$wotd")) {
        const { word, definition } = await getWordOfTheDay();
        await updateWotd(word);
        msg = msg.replaceAll(
            "$wotd",
            `Word of the Day: **${word}**
${definition}*`
        );
    }
    msg = msg.replaceAll(
        "\\n",
        `
`
    );
    return msg;
};

const composeMsg = async (reaction, payload) => {
    const msg = await msgReplace(reaction[2], payload);
    const embeds = [];
    if (reaction[3] || reaction[4]) {
        try {
            const value = await msgReplace(reaction[4], payload);
            const fields = new EmbedBuilder().setColor("#3ad071").addFields({
                name: reaction[3],
                value,
            });
            embeds.push(fields);
        } catch (e) {
            console.log("error", e);
        }
    }
    const messageObj = {};
    if (msg) {
        messageObj.content = msg;
    }
    if (embeds.length) {
        messageObj.embeds = embeds;
    }
    return messageObj;
};

const doReactions = async (payload) => {
    const guild = await payload.client.guilds.fetch(payload.guildId);
    const sortedReactions = payload.reactions.sort((a) =>
        a[0] === "assignRole" || a[0] === "unassignRole" ? -1 : 0
    );
    for (let reaction of sortedReactions) {
        const reactionType = reaction[0];
        if (reactionType === "sendMessage") {
            let channel = reaction[1];
            if (channel === "channel") {
                channel = payload.message.channelId;
            }
            const messageObj = await composeMsg(reaction, payload);
            guild.channels.cache
                .get(channel)
                .send(messageObj)
                .catch((e) => console.log(e));
        }
        if (
            reactionType === "sendSticky" &&
            payload.message.author.id !== payload.client.user.id
        ) {
            const lastMessage = await getSticky(
                payload.guildId,
                payload.message.channelId
            );
            if (lastMessage) {
                try {
                    const msgToDelete =
                        await payload.message.channel.messages.fetch(
                            lastMessage.lastMessageId
                        );
                    if (msgToDelete) {
                        await msgToDelete.delete();
                    }
                } catch (e) {
                    /* no catch */
                }
            }
            const messageObj = await composeMsg(reaction, payload);
            const newMessage = await payload.message.channel.send(messageObj);
            await updateSticky(
                payload.guildId,
                payload.message.channelId,
                newMessage.id,
                lastMessage?.id
            );
        }
        if (reactionType === "sendDM") {
            const msg = await msgReplace(reaction[2], payload);
            let recipient;
            if (reaction[1] === "author") {
                recipient = payload.member;
            } else {
                recipient = guild.members.fetch(reaction[1]);
            }
            try {
                await recipient.send(msg);
                try {
                    await payload.reactionBy.send(
                        `DM to ${payload.member.user} sent successfully.`
                    );
                } catch (e) {
                    console.log(e);
                    /* no catch */
                }
            } catch (e2) {
                try {
                    await payload.reactionBy.send(
                        `ERROR! DM could not be sent to ${payload.member.user}.`
                    );
                } catch (e3) {
                    /* no catch */
                }
            }
        }
        if (reactionType === "assignAward") {
            if (reaction[1] === "leader") {
                const leaders = await getLeaderboard(reaction[2], 3);
                const user = await guild.members.fetch(
                    leaders[reaction[3]].dataValues.userId
                );
                await grantAchievement(
                    reaction[4],
                    user.user,
                    payload.guildId,
                    payload.client,
                    true
                );
            }
        }
        if (reactionType === "assignAchievement") {
            let recipient;
            if (reaction[1] === "mentions") {
                let { mentions } = payload;
                mentions.forEach(async (uid) => {
                    if (payload.message.author.id !== uid) {
                        const recipient = await guild.members.fetch(uid);
                        await grantAchievement(
                            reaction[2],
                            recipient,
                            guild.id,
                            payload.client
                        );
                    }
                });
            } else {
                if (reaction[1] === "author") {
                    recipient = payload.member;
                } else if (reaction[1] === "interactionUser") {
                    recipient = payload.message.interaction?.user;
                } else {
                    recipient = guild.members.fetch(reaction[1]);
                }
                if (recipient) {
                    grantAchievement(
                        reaction[2],
                        recipient,
                        guild.id,
                        payload.client
                    );
                }
            }
        }
        if (reactionType === "assignRole") {
            await payload.member.roles.add(reaction[1]);
        }
        if (reactionType === "unassignRole") {
            await payload.member.roles.remove(reaction[1]);
        }
        if (reactionType === "setCooldown") {
            let user = reaction[2] ? payload.member.user.id : "0";
            const hasCooldown = await getCooldown(reaction[1], user);
            await updateCooldown(
                { item: reaction[1], usedAt: new Date(), user },
                { where: { userId: user } },
                Boolean(hasCooldown)
            );
        }
        if (reactionType === "incrementCounter") {
            const counter = await getCounter(
                reaction[1],
                payload.message.author.id
            );
            if (counter === undefined) {
                await createCounter(reaction[1], payload.message.author.id);
            } else {
                await updateCounter(
                    reaction[1],
                    payload.message.author.id,
                    parseInt(counter.count) + 1
                );
            }
        }
    }
};

const removeColors = async (colors, rolesArray, member) => {
    await Promise.all(
        colors.map(async (c) => {
            if (rolesArray.includes(c.roleId)) {
                await member.roles.remove(c.roleId);
            }
        })
    );
};

const updateColor = async (member, cw, guildId) => {
    const colors = await getColors(guildId);
    const rolesArray = member.roles.cache.map((r) => r.id);
    const currentColor = colors.find((c) => rolesArray.includes(c.roleId));
    if (currentColor) {
        const sortedColors = colors.sort((a, b) => {
            return a.rank - b.rank;
        });
        let newColor = currentColor.roleId;
        sortedColors.forEach((c) => {
            if (currentColor.baseColor === c.baseColor && cw >= c.rank) {
                newColor = c.roleId;
            }
        });
        if (newColor != currentColor) {
            await removeColors(colors, rolesArray, member);
            await member.roles.add(newColor);
        }
    } else {
        if (cw > 0) {
            const defaultColor = colors.find((c) => c.default === true);
            await removeColors(colors, rolesArray, member);
            await member.roles.add(defaultColor.roleId);
        }
    }
};

export {
    chunkMessage,
    findCategory,
    generateLeaderboard,
    getWebhook,
    hasRoleplay,
    stripTupperReplies,
    switchActiveAchievement,
    grantAchievement,
    getUids,
    getWordOfTheDay,
    checkRestrictions,
    doReactions,
    updateColor,
    removeColors,
};
