// WIP - migrate messages from a normal channel to a forum channel using webhooks
import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";

import { DISCORDIA_BOT_TOKEN } from "../config.js";

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
client.login(DISCORDIA_BOT_TOKEN);

client.on("ready", async () => {
    const guildId = process.argv[2];
    const guild = await client.guilds.fetch(guildId);
    const emojis = await guild.emojis.fetch();
    const emojiObj = {};
    emojis.forEach((e) => {
        emojiObj[e.name] = `<:${e.name}:${e.id}>`;
    });
    // Object.assign(global, emojiObj)
    console.log(emojiObj);
    client.destroy();
});
