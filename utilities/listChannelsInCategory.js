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

client.on("ready", async () => {
    const guildId = process.argv[2];
    const categoryId = process.argv[3];
    const guild = await client.guilds.fetch(guildId);
    const allChannels = await guild.channels.fetch();
    const channelsInCategory = allChannels.filter((c) => {
        return c && c.type === 0 && c.parentId === categoryId;
    });
    console.log(channelsInCategory.map((c) => c.id).join(" "));
    client.destroy();
});
