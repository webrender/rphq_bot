import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import moment from "moment-timezone";

import {
    findCategory,
    switchActiveAchievement,
    generateLeaderboard,
    removeColors,
} from "../logic.js";
import {
    getAchievements,
    getUserAchievements,
    getCharactersWritten,
    getActiveRoleplays,
    getColors,
    getCategories,
    getGuildInfo,
} from "../dataAccessors.js";

const interactionCreate = async (interaction, client) => {
    if (interaction.isCommand()) {
        switch (interaction.commandName) {
            case "stick":
                stickHandler(interaction, client);
                break;
            case "channel":
                channelHandler(interaction, client);
                break;
            case "achievements":
                achievementsHandler(interaction, client);
                break;
            case "badge":
                badgeHandler(interaction, client);
                break;
            case "profile":
                profileHandler(interaction, client);
                break;
            case "leaders":
                leadersHandler(interaction, client);
                break;
            case "color":
                colorHandler(interaction, client);
                break;
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.includes("color")) {
            setColorHandler(interaction);
        }
        if (interaction.customId.includes("badge")) {
            setBadgeHandler(interaction, client);
        }
    }
    return;
};

const leadersHandler = async (interaction, client) => {
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
    const response = await generateLeaderboard(
        interaction.user.username,
        string,
        boardResponse.value,
        client
    );
    interaction.reply(response);
};

const profileHandler = async (interaction, client) => {
    let user = await interaction.options.get("user");
    if (!user) {
        user = interaction.user;
    } else {
        user = user.user;
    }
    const cw = await getCharactersWritten(user.id);
    // console.log("CW:", cw);
    const cwsum = cw.reduce((sum, a) => sum + parseInt(a.charactersWritten), 0);
    const cwsumMonth = cw.reduce((sum, a) => {
        const monthsAgo = moment.duration(moment().diff(a.minDate)).asMonths();
        if (monthsAgo <= 1) {
            return sum + parseInt(a.charactersWritten);
        }
        return sum;
    }, 0);
    const cwavg = cwsum / (cw.length || 0);
    const achievementResponse = await getUserAchievements(user.id);
    const achievements = achievementResponse.map((a) => a.dataValues);
    // build the achievements string
    const achievementString = await Promise.all(
        achievements.map(async (a) => {
            const roleObj = a.achievement?.dataValues;
            // const guild = await client.guilds.fetch(interaction.guildId);
            // const role = await guild.roles.fetch(roleObj?.roleId);
            return roleObj?.icon;
        })
    );
    const guild = await client.guilds.fetch(interaction.guildId);
    const member = await guild.members.fetch(user.id);
    const allRoleplays = await getActiveRoleplays(user.id);
    const allChannels = await guild.channels.fetch();
    const allThreads = await guild.channels.fetchActiveThreads();
    const roleplayFilter = [];
    const oneOnOnes = [];
    const groups = [];
    const starters = [];
    const categories = await getCategories(interaction.guildId);
    const oneOnOneCategories = categories.filter((c) => c.type === "one_one");
    const inactiveCategories = categories.filter((c) => c.type === "inactive");
    const archiveCategories = categories.filter((c) => c.type === "archive");
    const starterCategories = categories.filter((c) => c.type === "starter");
    allChannels.forEach((channel) => {
        const isInactive = inactiveCategories.find(
            (c) => c.categoryId === channel?.parent?.id
        );
        const isArchived = archiveCategories.find(
            (c) => c.categoryId === channel?.parent?.id
        );
        if (!isInactive && !isArchived) {
            roleplayFilter.push(channel);
            const isOneOne = oneOnOneCategories.find(
                (c) => c.categoryId === channel?.parent?.id
            );
            const isStarter = starterCategories.find(
                (c) => c.categoryId === channel?.parent?.id
            );
            if (isOneOne) {
                oneOnOnes.push(channel);
            } else if (isStarter) {
                starters.push(channel);
            } else {
                if (channel) {
                    groups.push(channel);
                }
            }
        }
    });
    allThreads.threads.forEach((channel) => {
        const isInactive = inactiveCategories.find(
            (c) => c.categoryId === channel?.parent?.parent?.id
        );
        const isArchived = archiveCategories.find(
            (c) => c.categoryId === channel?.parent?.parent?.id
        );
        if (!isInactive && !isArchived) {
            roleplayFilter.push(channel);
            const isOneOne = oneOnOneCategories.find(
                (c) => c.categoryId === channel?.parent?.parent?.id
            );
            const isStarter = starterCategories.find(
                (c) => c.categoryId === channel?.parent?.parent?.id
            );
            if (isOneOne) {
                oneOnOnes.push(channel);
            } else if (isStarter) {
                starters.push(channel);
            } else {
                if (channel) {
                    groups.push(channel);
                }
            }
        }
    });
    const filteredOneOnOnes = [];
    const filteredGroups = [];
    const filteredStarters = [];
    allRoleplays.forEach((c) => {
        if (starters.find((ch) => ch.id === c.channelId)) {
            filteredStarters.push(c);
        }
    });
    const activeRoleplays = allRoleplays.filter((r) => {
        const monthsAgo = moment
            .duration(moment().diff(r.updatedAt))
            .asMonths();
        return monthsAgo <= 1;
    });
    groups.forEach((g) => {
        if (!g?.id) {
            console.log(g);
        }
    });
    activeRoleplays.forEach((c) => {
        if (oneOnOnes.find((ch) => ch.id === c.channelId)) {
            filteredOneOnOnes.push(c);
        } else if (groups.find((ch) => ch.id === c.channelId)) {
            filteredGroups.push(c);
        }
    });
    //compose the embed
    const embed = new EmbedBuilder()
        .setColor(member.displayHexColor)
        .setTitle(`${user.username}'s RPHQ Profile`)
        .setDescription(
            `**Join date:** ${member.joinedAt.toLocaleDateString()}
**Roleplay written on RPHQ:** ${Math.round(
                cwsum
            ).toLocaleString()} characters (${Math.round(
                cwsumMonth
            ).toLocaleString()} in the last month)
**Average characters per post:** ${Math.round(
                cwavg || 0
            ).toLocaleString()} characters`
        )
        .addFields(
            {
                name: "Achievements",
                value:
                    achievementString.length > 0
                        ? achievementString.join("")
                        : "*No achievements yet.*",
            },
            {
                name: "Active 1:1 Roleplays",
                value:
                    filteredOneOnOnes.length > 0
                        ? filteredOneOnOnes
                              .map((c) => `<#${c.channelId}>`)
                              .join(" ")
                        : "*None.*",
            },
            {
                name: "Active Group Roleplays",
                value:
                    filteredGroups.length > 0
                        ? filteredGroups
                              .map((c) => `<#${c.channelId}>`)
                              .join(" ")
                        : "*None.*",
            },
            {
                name: "RP Starters",
                value:
                    filteredStarters.length > 0
                        ? filteredStarters
                              .map((c) => `<#${c.channelId}>`)
                              .join(" ")
                        : "*None.*",
            }
        );
    interaction.reply({
        embeds: [embed],
    });
};

const setBadgeHandler = async (interaction, client) => {
    const badgeVars = interaction.customId.split(":");
    if (badgeVars[1] === "next" || badgeVars[1] === "prev") {
        badgeHandler(interaction, client, badgeVars[2]);
    } else {
        switchActiveAchievement(
            badgeVars[1],
            interaction.user.id,
            interaction.guildId,
            client
        );
        interaction.update({
            content: "Badge set.",
            components: [],
        });
    }
};

const badgeHandler = async (interaction, client, achievementStart) => {
    const achievementRows = await getUserAchievements(interaction.user.id);
    if (achievementRows.length > 0) {
        const achievements = achievementRows.map(
            (a) => a.dataValues.achievement.dataValues
        );
        let numButtons = 1;
        const rows = [];
        let currentRow = [];
        if (!parseInt(achievementStart)) {
            currentRow.push(
                new ButtonBuilder()
                    .setCustomId("badge:none")
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("None")
            );
        } else {
            currentRow.push(
                new ButtonBuilder()
                    .setCustomId(`badge:prev:${achievementStart - 24}`)
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("«")
            );
        }
        for (
            let i = achievementStart || 0;
            numButtons <= 25 && achievements[i];
            i++
        ) {
            let button = new ButtonBuilder();
            if (numButtons === 24 && achievements[i + 1]) {
                button
                    .setCustomId(`badge:next:${i + 1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("»");
            } else {
                button
                    .setCustomId(`badge:${achievements[i].id}`)
                    .setStyle(ButtonStyle.Secondary);
                if (achievements[i].icon.includes(":")) {
                    button.setEmoji(
                        achievements[i].icon.split(":")[2].slice(0, -1)
                    );
                } else {
                    button.setLabel(achievements[i].icon);
                }
            }
            currentRow.push(button);
            numButtons++;
            if (currentRow.length === 5 || i + 1 === achievements.length) {
                rows.push(new ActionRowBuilder().addComponents(currentRow));
                currentRow = [];
            }
        }
        interaction.reply({
            content: "**Please choose the badge you'd like to use:**",
            ephemeral: true,
            components: rows,
        });
    } else {
        interaction.reply({
            content: "*You do not currently have any achievements.*",
            ephemeral: true,
        });
    }
};

const achievementsHandler = async (interaction, client) => {
    const achievements = await getAchievements(true);
    const achArray = await Promise.all(
        achievements.map(async (a) => {
            const guild = await client.guilds.fetch(interaction.guildId);
            const role = await guild.roles.fetch(a.roleId);
            return { ...a, name: role.name };
        })
    );
    const str = achArray
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map((a) => `${a.icon} **${a.name}** - ${a.description}`);
    const embed = new EmbedBuilder()
        .setColor("#F1C30E")
        .setTitle("Achievements")
        .setDescription(str.length > 0 ? str.join("\n") : "");
    interaction.reply({ embeds: [embed] });
};

const stickHandler = async (interaction, client) => {
    if (interaction.commandName === "stick") {
        const guildInfo = await getGuildInfo(interaction.guildId);
        await interaction.reply(`*<@${interaction.user.id}> pouts softly, expressing their frustration at failing to be heard in the busy room. They take out a polished stick, crafted from rich, gnarled wood. The stick begins to glow a bright purple, and motes of energy fly out from its tip, temporarily silencing the voices.*
        
**[Senpai's Stick: All users muted for 30 seconds.]**`);
        // Promote to Senpai's Stick role, give the role chat permissions, and remove general chat permissions on the channel
        await interaction.member.roles.add(guildInfo.senpaiRoleId);
        const channel = await client.channels.cache.get(interaction.channelId);
        await channel.permissionOverwrites.edit(interaction.user.id, {
            SendMessages: true,
        });
        await channel.permissionOverwrites.edit(guildInfo.senpaiMuteRoleId, {
            SendMessages: false,
        });
        // Set 30 second timeout to demote from role and restore chat permissions on channel
        setTimeout(async () => {
            await interaction.member.roles.remove(guildInfo.senpaiRoleId);
            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: null,
            });
            await channel.permissionOverwrites.delete(
                guildInfo.senpaiMuteRoleId
            );
            channel.send(`*The purple glow fades as the spell's grasp wanes from it's victims.*

**[Senpai's Stick: Normal chat permissions restored.]**`);
        }, 30000);
    }
};

const sortCategories = (a, b) => {
    const compare = a.start.localeCompare(b.start);
    if (compare === 0) {
        return a.createdAt - b.createdAt;
    } else {
        return compare;
    }
};

const channelHandler = async (interaction) => {
    const subcommand = await interaction.options.getSubcommand();
    const channelManager = await interaction.guild.channels;
    const user = await interaction.options.get("user");
    const categories = await getCategories(interaction.guildId);
    if (subcommand === "roleplay") {
        const channelResponse = await interaction.options.get("channel");
        const name = channelResponse.value.replace(" ", "-");
        const categoryCategory = categories
            .filter((c) => c.type === "one_one")
            .sort(sortCategories);
        console.log(categoryCategory);
        const parent = findCategory(name, categoryCategory);
        console.log("create", name, parent);
        await channelManager
            .create({
                name,
                parent,
            })
            .then((channelCreateResponse) => {
                console.log("created[");
                interaction.reply(
                    `1:1 Roleplay <#${channelCreateResponse?.id}> has been created for <@${user.user.id}>`
                );
            })
            .catch((e) => {
                interaction.reply(
                    e?.rawError?.errors?.parent_id?._errors?.[0]?.message ||
                        "Error"
                );
            });
    }
    if (subcommand === "starter") {
        const typeResponse = await interaction.options.get("category");
        const type = typeResponse.value;
        const channelResponse = await interaction.options.get("channel");
        const name = channelResponse.value.replace(" ", "-");
        let categoryCategory;
        if (type === "erotic") {
            categoryCategory = categories
                .filter((c) => c.subType === "erotic")
                .sort(sortCategories);
        } else if (type === "sol") {
            categoryCategory = categories
                .filter((c) => c.subType === "sol")
                .sort(sortCategories);
        } else {
            categoryCategory = categories
                .filter((c) => c.subType === "fantasy")
                .sort(sortCategories);
        }
        const parent = findCategory(name, categoryCategory);
        const channelCreateResponse = await channelManager.create({
            name,
            parent,
        });
        interaction.reply(
            `RP Starter <#${channelCreateResponse?.id}> has been created for <@${user.user.id}>`
        );
    }

    if (subcommand === "move") {
        const channel = await interaction.options.get("channel");
        const destinationResponse = await interaction.options.get(
            "destination"
        );
        const destination = destinationResponse.value;
        let destinationCategories;
        let destinationString = "";
        switch (destination) {
            case "starter":
                destinationCategories = categories
                    .filter((c) => c.type === "starter")
                    .sort(sortCategories);
                destinationString = "RP Starters";
                break;
            case "one_one":
                destinationCategories = categories
                    .filter((c) => c.type === "one_one")
                    .sort(sortCategories);
                destinationString = "1:1 Roleplay";
                break;
            case "inactive":
            default:
                destinationCategories = categories
                    .filter((c) => c.type === "inactive")
                    .sort(sortCategories);
                destinationString = "Inactive Roleplay";
                break;
        }

        const parent = findCategory(
            channel.channel.name,
            destinationCategories
        );
        const c = await channelManager.fetch(channel.channel.id);
        await c.setParent(parent);
        interaction.reply(
            `<#${channel.channel.id}> has been moved to ${destinationString}${
                user ? ` on behalf of <@${user.user.id}>` : ""
            }.`
        );
    }

    if (subcommand === "archive") {
        const channel = await interaction.options.get("channel");
        const archiveCategories = categories
            .filter((c) => c.type === "archive")
            .sort(sortCategories);
        const parent =
            archiveCategories[archiveCategories.length - 1].categoryId;
        const c = await channelManager.fetch(channel.channel.id);
        await c
            .setParent(parent)
            .then(() => {
                interaction.reply(
                    `<#${channel.channel.id}> has been archived${
                        user ? ` on behalf of <@${user.user.id}>` : ""
                    }.`
                );
            })
            .catch((e) => {
                interaction.reply(e.message.split(": ")[1]);
            });
    }
};

const colorHandler = async (interaction, client) => {
    const colorObj = {};
    const colors = await getColors(interaction.guildId);
    const cw = await getCharactersWritten(interaction.user.id);
    const cwsum = cw.reduce((sum, a) => sum + parseInt(a.charactersWritten), 0);
    const sortedColors = colors.sort((a, b) => {
        return a.rank - b.rank;
    });
    const rolesArray = interaction.member.roles.cache.map((r) => r.id);
    sortedColors.forEach((color) => {
        if (color.roleRestriction) {
            if (!rolesArray.includes(color.roleRestriction)) {
                return;
            }
        }
        if (cwsum >= parseInt(color.rank)) {
            colorObj[color.baseColor] = color.roleId;
        }
    });
    const rows = [];
    let currentRow = [];
    Object.keys(colorObj).forEach((c, i) => {
        currentRow.push(
            new ButtonBuilder()
                .setCustomId(`color:${colorObj[c]}`)
                .setLabel(c)
                .setStyle(ButtonStyle.Primary)
        );
        if (currentRow.length === 5 || i + 1 === Object.keys(colorObj).length) {
            rows.push(new ActionRowBuilder().addComponents(currentRow));
            currentRow = [];
        }
    });
    await interaction.reply({
        content: "Select your color:",
        ephemeral: true,
        components: rows,
    });
};

const setColorHandler = async (interaction) => {
    const roleId = interaction.customId.split(":")[1];
    const rolesArray = interaction.member.roles.cache.map((r) => r.id);
    const colors = await getColors(interaction.guildId);
    removeColors(colors, rolesArray, interaction.member);
    interaction.member.roles.add(roleId);
    interaction.update({
        content: "Color set.",
        components: [],
    });
};

export { interactionCreate };