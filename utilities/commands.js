// adds commands to a server - needs to be automated
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { BOT_TOKEN, CLIENT_ID } from "../config.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const channel = new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Manage roleplay channels")
    .addSubcommandGroup((subcommandGroup) =>
        subcommandGroup
            .setName("create")
            .setDescription("Create an RP channel")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("roleplay")
                    .setDescription("Create a 1:1 RP channel")
                    .addUserOption((option) =>
                        option
                            .setName("user")
                            .setDescription("The user requesting the channel")
                            .setRequired(true)
                    )
                    .addStringOption((option) =>
                        option
                            .setName("channel")
                            .setDescription(
                                "Name of the channel (spaces will be replaced with dashes)"
                            )
                            .setRequired(true)
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("starter")
                    .setDescription("Create a RP Starter channel")
                    .addStringOption((option) =>
                        option
                            .setName("category")
                            .setDescription("RP Starter category")
                            .setRequired(true)
                            .addChoices(
                                { name: "Fantasy", value: "fantasy" },
                                { name: "Slice of Life", value: "sol" },
                                { name: "Erotic", value: "erotic" }
                            )
                    )
                    .addUserOption((option) =>
                        option
                            .setName("user")
                            .setDescription("The user requesting the channel")
                            .setRequired(true)
                    )
                    .addStringOption((option) =>
                        option
                            .setName("channel")
                            .setDescription(
                                "Name of the channel (spaces will be replaced with dashes)"
                            )
                            .setRequired(true)
                    )
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("move")
            .setDescription("Move a channel")
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("The channel to move")
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("destination")
                    .setDescription("Where to move the channel")
                    .setRequired(true)
                    .addChoices(
                        { name: "RP Starters", value: "starter" },
                        { name: "1:1 Roleplay", value: "one_one" },
                        { name: "Inactive Roleplay", value: "inactive" }
                    )
            )
            .addUserOption((option) =>
                option
                    .setName("user")
                    .setDescription("The user requesting the operation")
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("archive")
            .setDescription("Archive a channel")
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("The channel to archive.")
                    .setRequired(true)
            )
            .addUserOption((option) =>
                option
                    .setName("user")
                    .setDescription("The user requesting the operation")
            )
    );

const echo = new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Echoes a statement using the bot.")
    .setDefaultPermission(false)
    .addStringOption((option) =>
        option
            .setName("statement")
            .setDescription("The thing you want to say.")
            .setRequired(true)
    );

const stick = new SlashCommandBuilder()
    .setName("stick")
    .setDescription("Use Senpai's Stick.")
    .setDefaultPermission(false);

const achievements = new SlashCommandBuilder()
    .setName("achievements")
    .setDescription("List all achievements.");

const profile = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Displays a user's profile.")
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription(
                "Which user's profile. Leave empty to see your own."
            )
    );

const leaders = new SlashCommandBuilder()
    .setName("leaders")
    .setDescription("View leaderboards.")
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
    );

const color = new SlashCommandBuilder()
    .setName("color")
    .setDescription("Changes your username color.");

const badge = new SlashCommandBuilder()
    .setName("badge")
    .setDescription("Sets the badge next to your name.");

channel.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
stick.setDefaultMemberPermissions(0);

const commands = [channel, stick, achievements, badge, profile, leaders, color];

(async function () {
    const commandJson = [];
    const guildId = process.argv[2];

    commands.forEach((command) => {
        commandJson.push(command.toJSON());
    });

    try {
        // register the commands
        console.log("Started refreshing application (/) commands.");
        const rest = new REST({ version: "9" }).setToken(BOT_TOKEN);
        const res = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, guildId),
            {
                body: commands,
            }
        );

        console.log(res);
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
