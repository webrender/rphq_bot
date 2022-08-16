// WIP - migrate messages from a normal channel to a forum channel using webhooks
import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";

import { BOT_TOKEN, CLIENT_ID } from "../config.js";

import { getWebhook } from "../logic.js";

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

const getMessages = async (channel, before) => {
    console.log(msgArray.length, before);
    const messages = await channel.messages.fetch({
        limit: 100,
        before,
    });
    if (messages.size > 0) {
        messages.each((m) => msgArray.push(m));
        await getMessages(channel, messages.last().id);
    }
};

client.on("ready", async () => {
    const fromChannel = process.argv[2];
    const forumChannel = process.argv[3];
    const fromChannelObj = await client.channels.fetch(fromChannel);
    const forumChannelObj = await client.channels.fetch(forumChannel);
    console.log(forumChannelObj);
    await getMessages(fromChannelObj);
    const messagesReverse = msgArray.reverse();
    const botClient = await client.users.cache.get(CLIENT_ID);
    const avatar = `https://cdn.discordapp.com/avatars/${botClient.id}/${botClient.avatar}.png`;
    const webhook = await forumChannelObj.guild.channels.createWebhook({
        channel: forumChannelObj.id,
        name: "Roleplay HQ Bot",
        avatar,
    });
    console.log(webhook);
    client.destroy();
});
