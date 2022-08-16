import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";

import { BOT_TOKEN } from "./config.js";

import { getChannelsToCache, getAllGuilds } from "./dataAccessors.js";

import { messageReactionAdd } from "./handlers/messageReactionAdd.js";
import { newMessage } from "./handlers/message.js";
import { messageDelete } from "./handlers/messageDelete.js";
import { messageUpdate } from "./handlers/messageUpdate.js";
import { interactionCreate } from "./handlers/interactionCreate.js";
import { channelCreate } from "./handlers/channelCreate.js";
import { channelUpdate } from "./handlers/channelUpdate.js";
import { guildMemberRemove } from "./handlers/guildMemberRemove.js";
import { guildMemberAdd } from "./handlers/guildMemberAdd.js";

const pendingBotMessages = [];
global.wotd = null;
global.actionsCache = {};
global.categoryCache = {};

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

process.on("uncaughtException", async (err) => {
    console.error(
        new Date().toUTCString() + " uncaughtException:",
        err.message
    );
    console.error(err.stack);
    const guilds = await getAllGuilds();
    await Promise.all(
        guilds.map(async (g) => {
            if (g.botStatusChannelId) {
                const channel = await client.channels.fetch(
                    g.botStatusChannelId
                );
                await channel.send(
                    "**ALERT: Roleplay HQ Bot has experienced a fatal error. Roleplay will not be recorded until the bot comes back online.**"
                );
            }
        })
    );
    process.exit(1);
});

// Tell moment, our date library, that Monday is the first day of the week.
moment.updateLocale("en", {
    week: {
        dow: 1,
    },
});

// Pull the last 10 intros so that we can react to them, even if the bot restarts.
client.on("ready", async () => {
    const channels = await getChannelsToCache();
    channels.forEach((c) => {
        client.channels.cache.get(c).messages.fetch({ limit: 20 });
    });
});

// Add reaction
client.on("messageReactionAdd", (reaction, reactionBy) => {
    messageReactionAdd(reaction, reactionBy, client);
});

// Message sent
client.on("messageCreate", async (msg) => {
    newMessage(msg, client, pendingBotMessages);
});

// Message deleted
client.on("messageDelete", async (msg) => {
    messageDelete(msg, pendingBotMessages);
});

// Message edited
client.on("messageUpdate", async (oldMessage, newMessage) => {
    messageUpdate(oldMessage, newMessage);
});

// Slash command sent
client.on("interactionCreate", async (interaction) => {
    interactionCreate(interaction, client);
});

client.on("channelCreate", async (channel) => {
    channelCreate(channel);
});

client.on("channelUpdate", async (oldChannel, newChannel) => {
    channelUpdate(oldChannel, newChannel);
});

client.on("guildMemberRemove", async (member) => {
    guildMemberRemove(member, client);
});

client.on("guildMemberAdd", async (member) => {
    guildMemberAdd(member, client);
});

// Login as the bot
client.login(BOT_TOKEN);
