// WIP - migrate messages from a normal channel to a forum channel using webhooks
import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";

import { BOT_TOKEN } from "../config.js";

import { getWebhook, grantAchievement } from "../logic.js";

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
    const guild = await client.guilds.fetch(guildId);
    const legendRole = await guild.roles.fetch(process.argv[3]);
    const storytellerRole = await guild.roles.fetch(process.argv[4]);
    const legendMemberIds = legendRole.members.map((m) => m.id);
    storytellerRole.members.forEach((m) => {
        if (
            moment.duration(moment().diff(m.joinedTimestamp)).asMonths() >= 3 &&
            !legendMemberIds.includes(m.user.id)
        ) {
            grantAchievement(36, m.user, guildId, client);
            m.roles.add(legendRole);
        }
    });
});
