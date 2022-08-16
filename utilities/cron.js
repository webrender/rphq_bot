// for running scheduled tasks such as leaderboard awards
import { Client, GatewayIntentBits, Partials } from "discord.js";
import moment from "moment-timezone";

import { BOT_TOKEN } from "../config.js";

import { doReactions } from "../logic.js";
import { getActions } from "../dataAccessors.js";

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
    const actionType = process.argv[2];
    const actions = await getActions(actionType);
    await Promise.all(
        actions.map(async (a) => {
            const guildId = a.guildId;
            await doReactions({
                guildId,
                reactions: JSON.parse(a.reaction),
                client,
            });
        })
    );
    client.destroy();
});
