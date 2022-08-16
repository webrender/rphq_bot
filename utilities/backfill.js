// for backfilling roleplay logs - requires node 18
import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { BOT_TOKEN } from "../config.js";
import { createRoleplayLog } from "../dataAccessors.js";

// Tell moment, our date library, that Monday is the first day of the week.
moment.updateLocale("en", {
    week: {
        dow: 1,
    },
});

// Initiate our Discord client and let the API know the permissions we need.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});
global.actionsCache = {};
client.login(BOT_TOKEN);
const msgArray = [];
const beforeMessages = [];
const afterMessages = [];

const rl = readline.createInterface({ input, output });

const getMessages = async (channel, b, a) => {
    let before;
    if (b) {
        before = await channel.messages.fetch({
            limit: 100,
            before: b,
        });
    } else {
        before = await channel.messages.fetch({
            limit: 100,
        });
    }
    before.each((m) => beforeMessages.push(m));
    const after = await channel.messages.fetch({
        limit: 100,
        after: a,
    });
    after.each((m) => afterMessages.push(m));
    afterMessages.forEach((msg) => {
        const msgInBefore = beforeMessages.find((m) => msg.id === m.id);
        if (msgInBefore) {
            msgArray.push(msg);
        }
    });
    return msgArray;
};

const botIdentities = {};

client.on("ready", async () => {
    const channelId = await rl.question(
        "Enter the channel ID you wish to backfill:"
    );
    const afterId = await rl.question(
        "Enter the ID of the message BEFORE the start of the backfill:"
    );
    const beforeId = await rl.question(
        "Enter the ID of the message AFTER the end of the backfill, or press enter if you would like to backfill to the most recent message:"
    );
    const channel = await client.channels.fetch(channelId);
    const messages = await getMessages(channel, beforeId, afterId);
    const messagesReverse = messages.reverse();
    const authors = new Set(messagesReverse.map((m) => m.author.username));
    for (const a in authors) {
        const uid =
            await `Enter the true UID for ${a} or press enter if this is not a Tupper:`;
        if (uid) {
            botIdentities[a] = uid;
        } else {
            const msg = messages.find((m) => m.author.username === a);
            botIdentities[a] = msg.author.id;
        }
    }
    messagesReverse.forEach((m) => {
        const actualUser = botIdentities[m.author.username] || m.author.id;
        createRoleplayLog({
            messageId: m.id,
            userId: actualUser,
            length: m.content.length,
            createdAt: moment(m.createdTimestamp).utc(),
            channelId,
        });
    });
    client.destroy();
    rl.close();
});
