import {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    SlashCommandBuilder,
    EmbedBuilder,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import moment from "moment-timezone";

import { LEADERBOARD_BOT_TOKEN } from "../config.js";
import { Routes } from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
import {
    updateRoleplayLog,
    createRoleplayFilter,
    getRoleplayFilters,
    removeRoleplayFilter,
    upsertGuild,
    getCharactersWritten,
    getGuilds,
    getAllGuilds,
    getGuildInfo,
    getActiveRoleplays,
    upsertRoleplayFilter,
} from "../dataAccessors.js";
import {
    hasRoleplay,
    processRPFromUser,
    processRPFromBot,
    stripTupperReplies,
    generateLeaderboard,
} from "../logic.js";

const pendingBotMessages = [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

// Tell moment, our date library, that Monday is the first day of the week.
moment.updateLocale("en", {
    week: {
        dow: 1,
    },
});

const leaders = new SlashCommandBuilder()
    .setName("leaders")
    .setDescription("View this server's leaderboards.")
    .addStringOption((option) =>
        option
            .setName("board")
            .setDescription("Which leaderboard to display.")
            .addChoices(
                { name: "Current 12 hours", value: "hour" },
                { name: "Previous 12 hours", value: "phour" },
                { name: "Today", value: "day" },
                { name: "Yesterday", value: "pday" },
                { name: "This week", value: "week" },
                { name: "Last week", value: "pweek" },
                { name: "This month", value: "month" },
                { name: "Last month", value: "pmonth" }
            )
            .setRequired(true)
    )
    .addBooleanOption((option) =>
        option.setName("private").setDescription("Posts the profile privately.")
    );

const gleaders = new SlashCommandBuilder()
    .setName("gleaders")
    .setDescription("View global leaderboards.")
    .addStringOption((option) =>
        option
            .setName("board")
            .setDescription("Which leaderboard to display.")
            .addChoices(
                { name: "Current 12 hours", value: "hour" },
                { name: "Previous 12 hours", value: "phour" },
                { name: "Today", value: "day" },
                { name: "Yesterday", value: "pday" },
                { name: "This week", value: "week" },
                { name: "Last week", value: "pweek" },
                { name: "This month", value: "month" },
                { name: "Last month", value: "pmonth" }
            )
            .setRequired(true)
    )
    .addBooleanOption((option) =>
        option.setName("private").setDescription("Posts the profile privately.")
    );

const profile = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Displays a user's profile.")
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription(
                "Which user's profile. Leave empty to see your own."
            )
    )
    .addBooleanOption((option) =>
        option.setName("private").setDescription("Posts the profile privately.")
    );

const register = new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register channels or categories as roleplay")
    .addChannelOption((option) =>
        option
            .setName("channelname")
            .setDescription("The channel or category to register")
            .setRequired(true)
    );

const unregister = new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister channels or categories as roleplay")
    .addChannelOption((option) =>
        option
            .setName("channelname")
            .setDescription("The channel or category to unregister")
            .setRequired(true)
    );

const config = new SlashCommandBuilder()
    .setName("config")
    .setDescription("Adjust bot configuration settings");

const help = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Information about RPHQ Leaderboard commands");

const trackThread = new SlashCommandBuilder()
    .setName("trackthread")
    .setDescription(
        "Tracks a thread as roleplay when Track Threads is disabled"
    );

const ignoreThread = new SlashCommandBuilder()
    .setName("ignorethread")
    .setDescription(
        "Ignores a thread as roleplay when Track Threads is enabled."
    );

register.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
help.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
unregister.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
config.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
trackThread.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
ignoreThread.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

const commands = [
    leaders,
    gleaders,
    profile,
    register,
    unregister,
    help,
    config,
    trackThread,
    ignoreThread,
];

client.on("guildCreate", async (guild) => {
    const guildInfo = await upsertGuild({
        guildId: guild.id,
        guildName: guild.name,
    });
    if (guildInfo.banned) {
        guild.leave();
        return;
    }
    registerCommands(guild.id);
});

const registerCommands = async (guildId) => {
    const commandJson = [];

    commands.forEach((command) => {
        commandJson.push(command.toJSON());
    });

    try {
        // register the commands
        console.log("Started refreshing application (/) commands.");
        const rest = new REST({ version: "9" }).setToken(LEADERBOARD_BOT_TOKEN);
        const res = await rest.put(
            Routes.applicationGuildCommands(client.application.id, guildId),
            {
                body: commands,
            }
        );

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
};

client.on("messageCreate", async (message) => {
    if (!message.guild && message.author.id === "840393634272772116") {
        if (message.content.indexOf("ban") === 0) {
            const guildId = message.content.split(" ")[1];
            if (guildId) {
                const guilds = await getAllGuilds();
                const guild = guilds.find((g) => (g.guildId = guildId));
                if (guild) {
                    await upsertGuild({
                        guildId: guildId,
                        banned: true,
                    });
                    const guildToLeave = await client.guilds.fetch(guildId);
                    guildToLeave.leave();
                    message.reply("Guild banned.");
                }
            }
        }
        if (message.content.indexOf("refreshCommands") === 0) {
            const guilds = await getAllGuilds();
            for (const guild of guilds) {
                registerCommands(guild.guildId);
            }
        }
    } else {
        if (message.author.id == client.user.id || !message.guild) {
            return;
        }
        const text = message.content.trim();
        // see if this is a message in a roleplay channel
        const isRoleplay = await hasRoleplay(message);
        if (isRoleplay) {
            if (message.author.bot) {
                await processRPFromBot(
                    text,
                    message,
                    client,
                    pendingBotMessages
                );
            } else {
                await processRPFromUser(text, message, client);
            }
        }
    }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
    const isRoleplay = await hasRoleplay(oldMessage);
    if (isRoleplay) {
        const trimmedText = newMessage.content.trim();
        updateRoleplayLog(
            { length: trimmedText.length },
            { where: { messageId: oldMessage.id } }
        );
    }
});

client.on("messageDelete", async (message) => {
    // we can't see who has deleted a message, so we need to treat all deletions
    // the same.  create a timeout which will perform the actual deletion.  then,
    // in the pendingBotMessages array, we store an object with the message ID,
    // timeout ID, and message text.  If the message was deleted because Tupper is
    // about to post on behalf of an avatar, we will compare it to the text in this
    // array and use it to update the message instead of deleting it.
    const isRoleplay = await hasRoleplay(message);
    if (isRoleplay) {
        const text = stripTupperReplies(message.content.trim());
        setTimeout(() => {
            // see if this message matches one in pendingBotMessages
            const botMessageIdx = pendingBotMessages.findIndex(
                (m) => text.indexOf(m.text) > -1
            );
            if (botMessageIdx > -1) {
                // if it matches, update the log with the tupper message ID & length
                updateRoleplayLog(
                    {
                        messageId: pendingBotMessages[botMessageIdx].id, // change the ID to reflect the tupper message
                        length: pendingBotMessages[botMessageIdx].text.length, // instead of the user message
                    },
                    {
                        where: {
                            messageId: message.id,
                        },
                    }
                );
            } else {
                // if there's no match, this is a real deletion
                updateRoleplayLog(
                    { deletedAt: new Date().getTime() },
                    { where: { messageId: message.id } }
                );
            }
            // clean up the pending messages array
            for (var i = pendingBotMessages.length - 1; i >= 0; i--) {
                // is the current message
                const isThisMessage =
                    pendingBotMessages[i].id ===
                    pendingBotMessages[botMessageIdx || 0];

                // is an expired message - over 10 seconds old
                const isOldMessage =
                    pendingBotMessages[i].timestamp <= Date.now() / 1000 - 10;

                // if it's this message or an old message, remove from the pendingBotMessages array
                if (isThisMessage || isOldMessage) {
                    pendingBotMessages.splice(i, 1);
                }
            }
        }, 10000);
    }
});

client.on("ready", async () => {
    console.log(client.application.id);
});

const trackThreadsEmbed = [
    new EmbedBuilder()
        .setTitle("Track Threads")
        .setDescription(
            "Automatically counts threads within a registered channel/category as roleplay."
        ),
];

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        const buttonData = interaction.customId.split("-");
        const buttonState = Boolean(buttonData[1] === "true");
        await upsertGuild({
            guildId: interaction.guildId,
            [buttonData[0]]: buttonData[1],
        });
        interaction.update({
            embeds: trackThreadsEmbed,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("ignoreThreads-false")
                        .setLabel("Enable")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(!buttonState),
                    new ButtonBuilder()
                        .setCustomId("ignoreThreads-true")
                        .setLabel("Disable")
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(buttonState)
                ),
            ],
            ephemeral: true,
        });
    } else {
        switch (interaction.commandName) {
            case "help":
                helpHandler(interaction);
                break;
            case "leaders":
            case "gleaders":
                leadersHandler(interaction);
                break;
            case "profile":
                profileHandler(interaction);
                break;
            case "register":
                registerHandler(interaction);
                break;
            case "unregister":
                unregisterHandler(interaction);
                break;
            case "config":
                configHandler(interaction);
                break;
            case "trackthread":
            case "ignorethread":
                threadHandler(interaction);
                break;
        }
    }
});

const threadHandler = async (interaction) => {
    const channel = await client.channels.fetch(interaction.channelId);
    const { commandName } = interaction;
    if (!channel.isThread()) {
        return interaction.reply({
            content: "This command can only be used in a thread.",
            ephemeral: true,
        });
    }
    await upsertRoleplayFilter({
        discordId: interaction.channelId,
        guildId: interaction.guildId,
        type: commandName,
    });
    interaction.reply({
        content: `Now ${
            commandName === "ignorethread" ? "ignoring" : "tracking"
        } thread. Use ${
            commandName === "ignorethread"
                ? "`/trackthread` to track it again."
                : "`/ignorethread` to ignore it again."
        }`,
        ephemeral: true,
    });
};

const configHandler = async (interaction) => {
    const guild = await getGuildInfo(interaction.guildId);
    interaction.reply({
        embeds: trackThreadsEmbed,
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ignoreThreads-false")
                    .setLabel("Enable")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(Boolean(!guild.ignoreThreads)),
                new ButtonBuilder()
                    .setCustomId("ignoreThreads-true")
                    .setLabel("Disable")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(Boolean(guild.ignoreThreads))
            ),
        ],
        ephemeral: true,
    });
};

const helpHandler = async (interaction) => {
    interaction.reply({
        content: `**RPHQ Leaderboard Commands**
\`/leaders\` Displays the leaderboards for this server.
\`/gleaders\` Displays the global leaderboards for all servers using this bot.
\`/profile\` Displays a user's profile.

**Admin-Only Commands**
\`/config\` Adjusts configuration options for this server.
\`/register\` Registers a channel/category with the bot as an RP channel.
\`/unregister\` Unregisters a channel/category with the bot.
\`/trackthread\` Track a specific thread.  To be used when "Track Threads" configuration option is OFF.
\`/ignorethread\` Ignore a specific thread. To be used when "Track Threads" configuration option is ON.`,
        ephemeral: true,
    });
};

const leadersHandler = async (interaction) => {
    const ephemeral = await interaction.options.get("private")?.value;
    await interaction.deferReply({ ephemeral });
    let string = `Today's`;
    const boardResponse = await interaction.options.get("board");
    switch (boardResponse.value) {
        case "hour":
            string = `Half-day's`;
            break;
        case "phour":
            string = `Previous Half-day's`;
            break;
        case "day":
            // already defined, do nothing
            break;
        case "pday":
            string = `Previous Day's`;
            break;
        case "week":
            string = `This Week's`;
            break;
        case "pweek":
            string = `Previous Week's`;
            break;
        case "month":
            string = `This Month's`;
            break;
        case "pmonth":
            string = `Previous Month's`;
            break;
    }
    // pull the data and return the generated leaderboard
    if (interaction.commandName === "gleaders") {
        string = string + " Global ";
        const content = await generateLeaderboard(
            interaction.user.username,
            string,
            boardResponse.value,
            client
        );
        interaction.editReply({
            content,
            ephemeral,
        });
    } else {
        const content = await generateLeaderboard(
            interaction.user.username,
            string,
            boardResponse.value,
            client,
            interaction.guildId
        );
        interaction.editReply({
            content,
            ephemeral,
        });
    }
};

const registerHandler = async (interaction) => {
    const channel = await interaction.options.get("channelname").channel;
    const guildId = interaction.guild.id;
    const discordId = channel.id;
    const type =
        channel.type === 4 || channel.type === 15 ? "category" : "channel";
    await createRoleplayFilter({ guildId, discordId, type });
    interaction.reply({
        content: "Roleplay filter registered.",
        ephemeral: true,
    });
};

const unregisterHandler = async (interaction) => {
    const channel = await interaction.options.get("channelname").channel;
    const guildId = interaction.guild.id;
    const discordId = channel.id;
    const type =
        channel.type === 4 || channel.type === 15 ? "category" : "channel";
    const existingFilters = await getRoleplayFilters();
    const filterToRemove = existingFilters.find(
        (f) =>
            f.guildId === guildId &&
            f.type === type &&
            f.discordId === discordId
    );
    if (filterToRemove) {
        await removeRoleplayFilter(filterToRemove.id);
        interaction.reply({
            content: "Roleplay filter unregistered.",
            ephemeral: true,
        });
    } else {
        interaction.reply({
            content: "No filter found.",
            ephemeral: true,
        });
    }
};

const profileHandler = async (interaction) => {
    let ephemeral = await interaction.options.get("private")?.value;
    await interaction.deferReply({ ephemeral });
    let user = await interaction.options.get("user");
    if (!user) {
        user = interaction.user;
    } else {
        user = user.user;
    }
    const cw = await getCharactersWritten(user.id, interaction.guildId);
    const gcw = await getCharactersWritten(user.id);
    const guilds = await getGuilds(user.id);
    const filteredGuilds = guilds.filter((g) => g !== interaction.guild.name);

    const cwsum = cw.reduce((sum, a) => sum + parseInt(a.charactersWritten), 0);
    const gcwsum = gcw.reduce(
        (sum, a) => sum + parseInt(a.charactersWritten),
        0
    );
    const cwsumMonth = cw.reduce((sum, a) => {
        const monthsAgo = moment.duration(moment().diff(a.minDate)).asMonths();
        if (monthsAgo <= 1) {
            return sum + parseInt(a.charactersWritten);
        }
        return sum;
    }, 0);
    const gcwsumMonth = gcw.reduce((sum, a) => {
        const monthsAgo = moment.duration(moment().diff(a.minDate)).asMonths();
        if (monthsAgo <= 1) {
            return sum + parseInt(a.charactersWritten);
        }
        return sum;
    }, 0);
    const cwavg = cwsum / (cw.length || 0);
    const gcwavg = gcwsum / (gcw.length || 0);
    const guild = await client.guilds.fetch(interaction.guildId);
    const member = await guild.members.fetch(user.id);
    const allRoleplays = await getActiveRoleplays(user.id, interaction.guildId);
    const activeRoleplays = [];
    const inactiveRoleplays = [];
    allRoleplays.forEach((r) => {
        const monthsAgo = moment
            .duration(moment().diff(r.updatedAt))
            .asMonths();
        if (monthsAgo <= 1) {
            activeRoleplays.push(r);
        } else {
            inactiveRoleplays.push(r);
        }
    });
    //compose the embed
    const embed = new EmbedBuilder()
        .setColor(member.displayHexColor)
        .setTitle(`${user.username}'s Profile`)
        .setDescription(
            `**Join date:** ${member.joinedAt.toLocaleDateString()}
**Roleplay written on this server:** ${Math.round(
                cwsum
            ).toLocaleString()} characters (${Math.round(
                cwsumMonth
            ).toLocaleString()} in the last month)
**Average characters per post:** ${Math.round(
                cwavg || 0
            ).toLocaleString()} characters (${Math.round(
                gcwavg || 0
            ).toLocaleString()} globally)`
        )
        .addFields(
            {
                name: "Active Roleplays",
                value:
                    activeRoleplays.length > 0
                        ? activeRoleplays
                              .map((c) => `<#${c.channelId}>`)
                              .join(" ")
                        : "*None.*",
            },
            {
                name: "Inactive Roleplays",
                value:
                    inactiveRoleplays.length > 0
                        ? inactiveRoleplays
                              .map((c) => `<#${c.channelId}>`)
                              .join(" ")
                        : "*None.*",
            },
            {
                name: "Global character count",
                value: `${Math.round(
                    gcwsum
                ).toLocaleString()} characters (${Math.round(
                    gcwsumMonth
                ).toLocaleString()} in the last month)`,
            },
            {
                name: "Also roleplays on:",
                value: filteredGuilds.length
                    ? filteredGuilds.join(", ")
                    : "*None*",
            }
        );
    interaction.editReply({
        embeds: [embed],
        ephemeral,
    });
};

process.on("uncaughtException", async (err) => {
    console.error(
        new Date().toUTCString() + " uncaughtException:",
        err.message
    );
    console.error(err.stack);
    const channel = await client.channels.fetch("1019101442491043892");
    await channel.send(
        "**ALERT: The leaderboards bot has experienced an error - roleplay may not be recorded until the problem is fixed. Stay tuned for updates.**"
    );
    process.exit(1);
});

client.login(LEADERBOARD_BOT_TOKEN);
