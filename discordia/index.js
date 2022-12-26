import {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import moment from "moment-timezone";
import { createHmac } from "node:crypto";

import { DISCORDIA_BOT_TOKEN } from "../config.js";
import { Routes } from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
import {
    upsertGuild,
    getAllGuilds,
    getOrCreateGarden,
    crops,
    cropEmoji,
    addToGarden,
    harvestItems,
    waterItems,
    buyCrops,
    sellItems,
    itemEmoji,
    upsertTrade,
    getTrade,
    tradeItems,
    getMessages,
    addMessage,
    getCharacterCounts,
    updateCharacterCounts,
    increaseWater,
} from "../dataAccessors.js";
import { groupGardenData, hasRoleplay } from "../logic.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

let characterCounts;

// Tell moment, our date library, that Monday is the first day of the week.
moment.updateLocale("en", {
    week: {
        dow: 1,
    },
});

let lastUncaughtException;
let lastCharacterCountUpdate = moment();

Error.stackTraceLimit = Infinity;

const emoji = {
    a1: "<:a1:1051044286461906945>",
    a2: "<:a2:1051044287669878835>",
    apple01: "<:apple01:1051341538187301005>",
    apple02: "<:apple02:1051341539575615508>",
    apple03: "<:apple03:1051341541001666591>",
    apple32: "<:apple32:1051044325884174336>",
    apple53: "<:apple53:1051044327285080074>",
    apple121: "<:apple121:1051044351498792980>",
    apple232: "<:apple232:1051044353180708904>",
    apple452: "<:apple452:1051044354480934922>",
    apple3451: "<:apple3451:1051044355705688145>",
    b1: "<:b1:1051044387578196069>",
    b2: "<:b2:1051044388916187147>",
    berry01: "<:berry01:1051341542448709650>",
    berry02: "<:berry02:1051341568449191986>",
    berry03: "<:berry03:1051341569850085477>",
    berry231: "<:berry231:1051044416128831498>",
    berry342: "<:berry342:1051044417621983283>",
    berry4512: "<:berry4512:1051044445556068403>",
    berry123453: "<:berry123453:1051381006713749525>",
    bush12: "<:bush12:1051044448735346779>",
    c1: "<:c1:1051044450350145566>",
    c2: "<:c2:1051044483204141057>",
    cherry01: "<:cherry01:1051341571146133547>",
    cherry02: "<:cherry02:1051341572635103293>",
    cherry03: "<:cherry03:1051341608139890689>",
    cherry31: "<:cherry31:1051044517874237440>",
    cherry53: "<:cherry53:1051044519136739418>",
    cherry121: "<:cherry121:1051044520717983785>",
    cherry232: "<:cherry232:1051044542394151003>",
    cherry451: "<:cherry451:1051044544159940638>",
    cherry452: "<:cherry452:1051044546181599272>",
    corn01: "<:corn01:1051341610014736384>",
    corn02: "<:corn02:1051341611352739873>",
    corn03: "<:corn03:1051341613412134912>",
    corn21: "<:corn21:1051044579245297684>",
    corn32: "<:corn32:1051044597071085610>",
    corn42: "<:corn42:1051381008236302386>",
    corn52: "<:corn52:1051044599721906176>",
    corn3451: "<:corn3451:1051044601064083466>",
    corn123453: "<:corn123453:1051044640444391436>",
    corn1: "<:corn1:1051569082517958796>",
    d1: "<:d1:1051044642134691933>",
    d2: "<:d2:1051044643506237490>",
    e1: "<:e1:1051044644856799242>",
    e2: "<:e2:1051044646203175002>",
    empty: "<:empty:1051044647570518067>",
    five1: "<:five1:1051045196974006272>",
    five2: "<:five2:1051045198307790898>",
    four1: "<:four1:1051045199729655828>",
    four2: "<:four2:1051045201386410014>",
    grape01: "<:grape01:1051341838033879050>",
    grape02: "<:grape02:1051341839321550968>",
    grape03: "<:grape03:1051341841066369085>",
    grape11: "<:grape11:1051045240766726214>",
    grape32: "<:grape32:1051045242356383794>",
    grape53: "<:grape53:1051045243685974036>",
    grape452: "<:grape452:1051045245044928512>",
    grape23451: "<:grape23451:1051045263508242462>",
    house1: "<:house1:1051045265341173760>",
    house2: "<:house2:1051045266960158770>",
    house3: "<:house3:1051045268503679018>",
    house4: "<:house4:1051045286006509609>",
    lemon01: "<:lemon01:1051341842890899528>",
    lemon02: "<:lemon02:1051341882577408000>",
    lemon03: "<:lemon03:1051341883751805020>",
    lemon31: "<:lemon31:1051045307196121098>",
    lemon53: "<:lemon53:1051045308768993340>",
    lemon121: "<:lemon121:1051045309964369992>",
    lemon232: "<:lemon232:1051045327962116166>",
    lemon451: "<:lemon451:1051045330105405480>",
    lemon452: "<:lemon452:1051045331489525851>",
    one1: "<:one1:1051381347274473523>",
    one2: "<:one2:1051381348633415711>",
    peach01: "<:peach01:1051341885261750342>",
    peach02: "<:peach02:1051341886721380472>",
    peach03: "<:peach03:1051341902282244126>",
    peach32: "<:peach32:1051045404130689034>",
    peach53: "<:peach53:1051045405388963880>",
    peach121: "<:peach121:1051045406768910376>",
    peach231: "<:peach231:1051045422350749736>",
    peach452: "<:peach452:1051045423994912778>",
    peach3451: "<:peach3451:1051045425391603752>",
    three1: "<:three1:1051045426717020230>",
    three2: "<:three2:1051045449110392943>",
    tree_unwatered: "<:tree_unwatered:1051045450800705627>",
    tree1: "<:tree1:1051565907417235537>",
    tree3: "<:tree3:1051381349795250177>",
    treewatered: "<:treewatered:1051045454168731698>",
    tree12: "<:tree12:1051045468559384606>",
    two1: "<:two1:1051381351204528130>",
    two2: "<:two2:1051381368875126856>",
    vinewatered: "<:vinewatered:1051045473315729518>",
    vine1: "<:vine1:1051566529268944947>",
    vine122: "<:vine122:1051045494400503818>",
    vine12343: "<:vine12343:1051045495826563102>",
    coin: "<:coin:1054553691513950291>",
};
const items = {
    green_apple6: [
        emoji.apple3451,
        emoji.apple452,
        emoji.apple53,
        emoji.tree_unwatered,
    ],
    green_apple5: [
        emoji.apple3451,
        emoji.apple452,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    green_apple4: [
        emoji.apple3451,
        emoji.apple32,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    green_apple3: [
        emoji.apple121,
        emoji.apple232,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    green_apple2: [
        emoji.apple121,
        emoji.tree12,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    green_apple1: [
        emoji.tree1,
        emoji.tree12,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    green_apple0: [emoji.apple01, emoji.apple02, emoji.apple03, emoji.empty],
    blueberry6: [
        emoji.berry4512,
        emoji.berry4512,
        emoji.berry123453,
        emoji.empty,
    ],
    blueberry5: [
        emoji.berry4512,
        emoji.berry4512,
        emoji.berry123453,
        emoji.empty,
    ],
    blueberry4: [
        emoji.berry231,
        emoji.berry342,
        emoji.berry123453,
        emoji.empty,
    ],
    blueberry3: [emoji.berry231, emoji.bush12, emoji.berry123453, emoji.empty],
    blueberry2: [emoji.bush12, emoji.bush12, emoji.berry123453, emoji.empty],
    blueberry1: [
        emoji.bush12,
        emoji.bush12,
        emoji.bush12,
        emoji.tree_unwatered,
    ],
    blueberry0: [emoji.berry01, emoji.berry02, emoji.berry03, emoji.empty],
    cherries6: [
        emoji.cherry451,
        emoji.cherry452,
        emoji.cherry53,
        emoji.tree_unwatered,
    ],
    cherries5: [
        emoji.cherry451,
        emoji.cherry452,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    cherries4: [
        emoji.cherry31,
        emoji.cherry232,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    cherries3: [
        emoji.cherry121,
        emoji.cherry232,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    cherries2: [
        emoji.cherry121,
        emoji.tree12,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    cherries1: [emoji.tree1, emoji.tree12, emoji.tree3, emoji.tree_unwatered],
    cherries0: [emoji.cherry01, emoji.cherry02, emoji.cherry03, emoji.empty],
    corn6: [emoji.corn3451, emoji.corn52, emoji.corn123453, emoji.empty],
    corn5: [emoji.corn3451, emoji.corn42, emoji.corn123453, emoji.empty],
    corn4: [emoji.corn3451, emoji.corn32, emoji.corn123453, emoji.empty],
    corn3: [emoji.corn21, emoji.empty, emoji.corn123453, emoji.empty],
    corn2: [emoji.empty, emoji.empty, emoji.corn123453, emoji.empty],
    corn1: [emoji.empty, emoji.empty, emoji.corn1, emoji.empty],
    corn0: [emoji.corn01, emoji.corn02, emoji.corn03, emoji.empty],
    grapes6: [emoji.grape23451, emoji.grape452, emoji.grape53, emoji.empty],
    grapes5: [emoji.grape23451, emoji.grape452, emoji.vine12343, emoji.empty],
    grapes4: [emoji.grape23451, emoji.grape452, emoji.vine12343, emoji.empty],
    grapes3: [emoji.grape23451, emoji.grape32, emoji.vine12343, emoji.empty],
    grapes2: [emoji.grape11, emoji.vine122, emoji.vine12343, emoji.empty],
    grapes1: [emoji.vine1, emoji.vine122, emoji.vine12343, emoji.empty],
    grapes0: [emoji.grape01, emoji.grape02, emoji.grape03, emoji.empty],
    house: [emoji.house1, emoji.house2, emoji.house3, emoji.house4],
    lemon6: [
        emoji.lemon451,
        emoji.lemon452,
        emoji.lemon53,
        emoji.tree_unwatered,
    ],
    lemon5: [emoji.lemon451, emoji.lemon452, emoji.tree3, emoji.tree_unwatered],
    lemon4: [emoji.lemon31, emoji.lemon232, emoji.tree3, emoji.tree_unwatered],
    lemon3: [emoji.lemon121, emoji.lemon232, emoji.tree3, emoji.tree_unwatered],
    lemon2: [emoji.lemon121, emoji.tree12, emoji.tree3, emoji.tree_unwatered],
    lemon1: [emoji.tree1, emoji.tree12, emoji.tree3, emoji.tree_unwatered],
    lemon0: [emoji.lemon01, emoji.lemon02, emoji.lemon03, emoji.empty],
    peach6: [
        emoji.peach3451,
        emoji.peach452,
        emoji.peach53,
        emoji.tree_unwatered,
    ],
    peach5: [
        emoji.peach3451,
        emoji.peach452,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    peach4: [
        emoji.peach3451,
        emoji.peach452,
        emoji.tree3,
        emoji.tree_unwatered,
    ],
    peach3: [emoji.peach121, emoji.peach231, emoji.tree3, emoji.tree_unwatered],
    peach2: [emoji.peach121, emoji.tree12, emoji.tree3, emoji.tree_unwatered],
    peach1: [emoji.tree1, emoji.tree12, emoji.tree3, emoji.tree_unwatered],
    peach0: [emoji.peach01, emoji.peach02, emoji.peach03, emoji.empty],
};

const garden = new SlashCommandBuilder()
    .setName("garden")
    .setDescription("View a farm.")
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription("Which user's farm. Leave empty to see your own.")
    );

const help = new SlashCommandBuilder()
    .setName("gardenhelp")
    .setDescription("Discordia help.");

const commands = [garden, help];

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
        const rest = new REST({ version: "9" }).setToken(DISCORDIA_BOT_TOKEN);
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
    } else if (message.guild) {
        const isRoleplay = await hasRoleplay(message);
        let writeToDb = false;
        const characterCount = isRoleplay
            ? message.content.length * 3
            : message.content.length;
        if (!characterCounts[message.guildId]) {
            characterCounts[message.guildId] = {};
        }
        if (
            characterCounts[message.guildId][message.author.id] ||
            characterCounts[message.guildId][message.author.id] === 0
        ) {
            characterCounts[message.guildId][message.author.id] +=
                characterCount;
            if (characterCounts[message.guildId][message.author.id] >= 1000) {
                let numWaterToAdd = 0;
                while (
                    characterCounts[message.guildId][message.author.id] >= 1000
                ) {
                    numWaterToAdd++;
                    characterCounts[message.guildId][message.author.id] -= 1000;
                }
                await increaseWater(
                    message.guildId,
                    message.author.id,
                    numWaterToAdd
                );
                writeToDb = true;
            }
        }
        if (
            lastCharacterCountUpdate &&
            moment
                .duration(moment().diff(lastCharacterCountUpdate))
                .asMinutes() > 1
        ) {
            writeToDb = true;
        }
        if (writeToDb) {
            await updateCharacterCounts(characterCounts);
            lastCharacterCountUpdate = moment();
        }
    }
});

client.on("ready", async () => {
    console.log(client.application.id);
    characterCounts = await getCharacterCounts();
    console.log(characterCounts);
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() || interaction.isUserSelectMenu()) {
        if (interaction.customId.includes("main")) {
            mainHandler(interaction);
        }
        if (interaction.customId === "plant") {
            plantChooserHandler(interaction);
        }
        if (
            interaction.customId.includes("plantChoice") ||
            interaction.customId.includes("plantCoord")
        ) {
            plantHandler(interaction);
        }
        if (interaction.customId.includes("plantAt")) {
            plantAtHandler(interaction);
        }
        if (
            interaction.customId === "harvest" ||
            interaction.customId.includes("harvestCoord")
        ) {
            harvestChooserHandler(interaction);
        }
        if (interaction.customId.includes("harvestAt")) {
            harvestAtHandler(interaction);
        }
        if (
            interaction.customId === "water" ||
            interaction.customId.includes("waterCoord")
        ) {
            waterChooserHandler(interaction);
        }
        if (interaction.customId.includes("waterAt")) {
            waterAtHandler(interaction);
        }
        if (interaction.customId === "buy") {
            buyChooserHandler(interaction);
        }
        if (interaction.customId.includes("buyChoice")) {
            buyHandler(interaction);
        }
        if (interaction.customId === "sell") {
            sellChooserHandler(interaction);
        }
        if (
            interaction.customId.includes("sellChoice") ||
            interaction.customId.includes("sellStalks")
        ) {
            sellHandler(interaction);
        }
        if (interaction.customId.includes("trade")) {
            tradeHandler(interaction);
        }

        if (interaction.customId.includes("acceptTrd")) {
            acceptTradeHandler(interaction);
        }
    } else {
        switch (interaction.commandName) {
            case "gardenhelp":
                helpHandler(interaction);
                break;
            case "garden":
                gardenHandler(interaction);
                break;
        }
    }
});

const mainHandler = async (interaction, userId, stalksSold, tradeComplete) => {
    let user = false;
    if (userId) {
        user = await client.users.fetch(userId);
    }
    if (interaction.customId.includes("main-")) {
        user = await client.users.fetch(interaction.customId.split("-")[1]);
    }
    let gardenControlsEmbed = [];
    if (user) {
        const stalkPrice = await getStalkPrice(user.id);
        gardenControlsEmbed = [
            new EmbedBuilder().setTitle(
                `This farm is buying :corn: from the Stalk Market for :coin:**${stalkPrice}**`
            ),
        ];
        if (stalksSold) {
            gardenControlsEmbed[0].setDescription(
                `You just sold ${stalksSold} :corn: for :coin:**${
                    stalksSold * stalkPrice
                }**`
            );
        }
    }
    const gardenControlsEmbedData = await insertTradeEmbed(
        gardenControlsEmbed,
        interaction,
        user.id || interaction.user.id,
        tradeComplete
    );
    const components = await controls(
        user,
        interaction,
        null,
        gardenControlsEmbedData.trade
    );
    interaction.update({
        embeds: gardenControlsEmbedData.gardenControlsEmbed,
        components,
        ephemeral: true,
    });
};

const insertTradeEmbed = async (
    gardenControlsEmbed,
    interaction,
    gardenUserId,
    tradeComplete
) => {
    if (tradeComplete) {
        gardenControlsEmbed.push(
            new EmbedBuilder().setTitle(`Trade successful!`)
        );
        return {
            gardenControlsEmbed,
            trade: null,
        };
    }
    let trade;
    if (interaction.user.id === gardenUserId) {
        trade = await getTrade(interaction.guildId, interaction.user.id);
        if (trade) {
            let tradeTargetString = "";
            let exchangeString = "nothing";
            let tradeString = "nothing";
            if (trade.tradeTarget !== "all") {
                const user = await interaction.guild.members.fetch(
                    trade.tradeTarget
                );
                tradeTargetString = ` for ${user.user.username}`;
            }
            if (trade.exchangeItem !== "nothing") {
                exchangeString = `${itemEmoji[trade.exchangeItem]}**${
                    trade.exchangeAmount
                }**`;
            }
            if (trade.tradeItem !== "nothing") {
                tradeString = `${itemEmoji[trade.tradeItem]}**${
                    trade.tradeAmount
                }**`;
            }
            gardenControlsEmbed.push(
                new EmbedBuilder()
                    .setTitle(`You have an open trade${tradeTargetString}`)
                    .setDescription(
                        `You offer ${tradeString} for ${exchangeString}`
                    )
            );
        }
    } else {
        trade = await getTrade(interaction.guildId, gardenUserId);
        if (
            trade &&
            (trade.tradeTarget === "all" ||
                trade.tradeTarget === interaction.user.id)
        ) {
            let tradeTargetString = "";
            let exchangeString = "nothing";
            let tradeString = "nothing";
            if (trade.tradeTarget !== "all") {
                tradeTargetString = ` for you`;
            }
            if (trade.exchangeItem !== "nothing") {
                exchangeString = `${itemEmoji[trade.exchangeItem]}**${
                    trade.exchangeAmount
                }**`;
            }
            if (trade.tradeItem !== "nothing") {
                tradeString = `${itemEmoji[trade.tradeItem]}**${
                    trade.tradeAmount
                }**`;
            }
            gardenControlsEmbed.push(
                new EmbedBuilder()
                    .setTitle(`This farm has an open trade${tradeTargetString}`)
                    .setDescription(
                        `They offer ${tradeString} for ${exchangeString}`
                    )
            );
        } else {
            trade = false;
        }
    }
    return {
        gardenControlsEmbed,
        trade,
    };
};

const plantHandler = async (interaction) => {
    let gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    let cropType;
    let interactionData;
    let x = "none";
    let y = "none";
    if (interaction.customId.includes("plantChoice")) {
        cropType = interaction.customId.substr(12);
    } else {
        interactionData = interaction.customId.split("-");
        cropType = interactionData[1];
        y = interactionData[2];
        x = interactionData[3];
    }
    const crop = gardenData.data.find(
        (i) => i.x == 0 && i.y == 0 && i.itemId == cropType
    );
    if (crop) {
        let itemAtCoordinates = false;
        if (x !== "none" && y !== "none") {
            itemAtCoordinates = gardenData.data.find(
                (i) => i.x == x && i.y == y
            );
        }
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(
                    `Select where to plant your ${cropEmoji[cropType]}`
                ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-1-${x}-y`)
                        .setLabel("A")
                        .setStyle(
                            y == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-2-${x}-y`)
                        .setLabel("B")
                        .setStyle(
                            y == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-3-${x}-y`)
                        .setLabel("C")
                        .setStyle(
                            y == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-4-${x}-y`)
                        .setLabel("D")
                        .setStyle(
                            y == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-5-${x}-y`)
                        .setLabel("E")
                        .setStyle(
                            y == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-${y}-1-x`)
                        .setLabel("1")
                        .setStyle(
                            x == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-${y}-2-x`)
                        .setLabel("2")
                        .setStyle(
                            x == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-${y}-3-x`)
                        .setLabel("3")
                        .setStyle(
                            x == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-${y}-4-x`)
                        .setLabel("4")
                        .setStyle(
                            x == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`plantCoord-${cropType}-${y}-5-x`)
                        .setLabel("5")
                        .setStyle(
                            x == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("plant")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`plantAt-${y}-${x}-${cropType}`)
                        .setLabel(
                            itemAtCoordinates ? "Area not empty" : "Plant"
                        )
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(
                            Boolean(
                                x == "none" || y == "none" || itemAtCoordinates
                            )
                        )
                ),
            ],
        });
    } else {
        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`You don't have that crop!`)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("plant")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    }
};

const buyHandler = async (interaction) => {
    let gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const interactionData = interaction.customId.split("-");
    const cropType = interactionData[1];
    const cropAmt = interactionData[2];
    const coins = gardenData.data.find((i) => i.itemId === "coins");
    if (cropAmt) {
        //buy
        const cropsToBuy = [];
        for (let i = 0; i < cropAmt; i++) {
            cropsToBuy.push({
                guildId: interaction.guildId,
                userId: interaction.user.id,
                itemId: cropType,
                x: 0,
                y: 0,
                quantity: 1,
            });
        }
        await buyCrops(cropsToBuy);
        updateGarden(interaction);
    } else {
        if (coins.quantity && coins.quantity >= 10) {
            interaction.update({
                embeds: [
                    new EmbedBuilder().setTitle(
                        `How many ${cropEmoji[cropType]} would you like?`
                    ),
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-1`)
                            .setLabel("1")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(coins.quantity < 10),
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-2`)
                            .setLabel("2")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(coins.quantity < 20),
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-3`)
                            .setLabel("3")
                            .setDisabled(coins.quantity < 30)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-4`)
                            .setLabel("4")
                            .setDisabled(coins.quantity < 40)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-5`)
                            .setLabel("5")
                            .setDisabled(coins.quantity < 50)
                            .setStyle(ButtonStyle.Primary)
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-10`)
                            .setLabel("10")
                            .setDisabled(coins.quantity < 100)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`buyChoice-${cropType}-20`)
                            .setLabel("20")
                            .setDisabled(coins.quantity < 200)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("plant")
                            .setLabel("Go back")
                            .setStyle(ButtonStyle.Primary)
                    ),
                ],
            });
        } else {
            interaction.update({
                embeds: [
                    new EmbedBuilder().setTitle(
                        `You don't have enough money to buy anything!`
                    ),
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("main")
                            .setLabel("Go back")
                            .setStyle(ButtonStyle.Primary)
                    ),
                ],
                ephemeral: true,
            });
        }
    }
};

const plantAtHandler = async (interaction) => {
    const interactionData = interaction.customId.split("-");
    const y = interactionData[1];
    const x = interactionData[2];
    const cropType = interactionData[3];
    await addToGarden({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        itemId: cropType,
        quantity: 0,
        x,
        y,
        cropType,
    });
    updateGarden(interaction);
};

const updateGarden = async (interaction, userId, stalksSold, tradeComplete) => {
    let gardenUserId = userId || interaction.user.id;
    const gardenMessages = await getMessages(interaction.guildId, gardenUserId);
    let gardenData = await getOrCreateGarden(
        interaction.guildId,
        gardenUserId,
        Boolean(userId)
    );
    const garden = generateGarden(gardenData.data);
    const items = generateItems(gardenData.data);
    let gardenUser;
    if (userId) {
        gardenUser = await client.users.fetch(gardenUserId);
    }
    const gardenEmbed = new EmbedBuilder()
        .setTitle(
            `${gardenUser?.username || interaction.user.username}'s Garden`
        )
        .setDescription(
            `${garden}

${items}`
        );

    for (const gardenMessage of gardenMessages) {
        const guild = await client.guilds.fetch(interaction.guildId);
        const channel = await guild.channels.fetch(gardenMessage.channelId);
        const message = await channel.messages.fetch(gardenMessage.messageId);
        await message.edit({
            embeds: [gardenEmbed],
        });
    }

    mainHandler(interaction, gardenUser?.id, stalksSold, tradeComplete);
};

const plantChooserHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const groupedGardenData = groupGardenData(gardenData.data);
    const cropData = groupedGardenData.filter(
        (i) => i.x == 0 && i.y == 0 && crops.includes(i.itemId)
    );
    if (cropData.length === 0) {
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(`You have no crops to plant!`),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else {
        let buttons = [[]];
        for (let i = 0; i < cropData.length; i++) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`plantChoice-${cropData[i].itemId}`)
                    .setEmoji(cropEmoji[cropData[i].itemId])
                    .setStyle(ButtonStyle.Primary)
            );
            if (buttons[buttons.length - 1].length == 5) {
                buttons.push([]);
            }
            if (i + 1 === cropData.length) {
                buttons[buttons.length - 1].push(
                    new ButtonBuilder()
                        .setCustomId(`main`)
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                );
            }
        }

        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`Choose a crop to plant:`)],
            components: buttons.map((b) => {
                return new ActionRowBuilder().addComponents(b);
            }),
            ephemeral: true,
        });
    }
};

const buyChooserHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const coins = gardenData.data.find((i) => i.itemId === "coins");
    if (!coins.quantity || coins.quantity < 10) {
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(
                    `You don't have enough money to buy anything!`
                ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else {
        let buttons = [[]];
        for (let i = 0; i < crops.length; i++) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`buyChoice-${crops[i]}`)
                    .setEmoji(cropEmoji[crops[i]])
                    .setStyle(ButtonStyle.Primary)
            );
            if (buttons[buttons.length - 1].length == 5) {
                buttons.push([]);
            }
            if (i + 1 === crops.length) {
                buttons[buttons.length - 1].push(
                    new ButtonBuilder()
                        .setCustomId(`main`)
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                );
            }
        }

        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(
                    `Choose a crop to buy, :coin:**10** per crop:`
                ),
            ],
            components: buttons.map((b) => {
                return new ActionRowBuilder().addComponents(b);
            }),
            ephemeral: true,
        });
    }
};

const getStalkPrice = async (userId) => {
    let price;
    const n = parseInt(
        await createHmac(
            "sha256",
            `${userId}${new Date().toLocaleDateString()}`
        )
            .digest("hex")
            .slice(-2),
        16
    );
    if (n < 100) {
        price = 1;
    } else if (n >= 100 && n < 175) {
        price = 2;
    } else if (n >= 175 && n < 200) {
        price = 4;
    } else if (n >= 200 && n < 230) {
        price = 8;
    } else if (n >= 230 && n < 245) {
        price = 16;
    } else if (n >= 245 && n < 253) {
        price = 32;
    } else if (n >= 252) {
        price = 64;
    }
    return price;
};

const sellChooserHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const groupedGardenData = groupGardenData(gardenData.data);
    const harvestedCrops = groupedGardenData.filter(
        (i) => crops.includes(i.itemId) && i.x === 0 && i.y === 0
    );
    const stalkPrice = await getStalkPrice(interaction.user.id);
    if (harvestedCrops.length == 0) {
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(
                    `You don't have any crops to sell!`
                ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else {
        let buttons = [[]];
        for (let i = 0; i < harvestedCrops.length; i++) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`sellChoice-${harvestedCrops[i].itemId}`)
                    .setEmoji(cropEmoji[harvestedCrops[i].itemId])
                    .setStyle(ButtonStyle.Primary)
            );
            if (buttons[buttons.length - 1].length == 5) {
                buttons.push([]);
            }
            if (i + 1 === harvestedCrops.length) {
                buttons[buttons.length - 1].push(
                    new ButtonBuilder()
                        .setCustomId(`sellChoice-all`)
                        .setLabel("Sell All")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(harvestedCrops.length == 0),
                    new ButtonBuilder()
                        .setCustomId(`main`)
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                );
            }
        }
        interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle(
                        `Choose a crop to sell. Fruit sells for :coin:**2**.`
                    )
                    .setDescription(
                        `This garden is buying :corn: on the stalk market today for :coin:**${stalkPrice}**.`
                    ),
            ],
            components: buttons.map((b) => {
                return new ActionRowBuilder().addComponents(b);
            }),
            ephemeral: true,
        });
    }
};

const sellHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const cropData = gardenData.data.filter(
        (i) => i.x == 0 && i.y == 0 && crops.includes(i.itemId)
    );
    const interactionData = interaction.customId.split("-");
    let itemId, stalkPrice, stalkUser;
    const amount = interactionData[2];
    if (interactionData[0] === "sellStalks") {
        stalkUser = interactionData[1];
        itemId = "corn";
        stalkPrice = await getStalkPrice(stalkUser);
    } else {
        stalkPrice = await getStalkPrice(interaction.user.id);
        itemId = interactionData[1];
    }
    let salePrice = 0;
    let idsToDelete = [];
    if (itemId === "all") {
        cropData.forEach((crop) => {
            if (crop.itemId === "corn") {
                salePrice += stalkPrice;
            } else {
                salePrice += 2;
            }
            idsToDelete.push(crop.id);
        });
        await sellItems(interaction, salePrice, idsToDelete);
        if (stalkUser) {
            updateGarden(interaction, stalkUser, idsToDelete.length);
        } else {
            updateGarden(interaction);
        }
    } else if (amount) {
        const sortedCrops = cropData
            .filter((c) => c.itemId === itemId)
            .sort((a, b) => {
                a.id - b.id;
            });
        const amt = amount === "all" ? sortedCrops.length : parseInt(amount);
        for (let i = 0; i < amt; i++) {
            if (sortedCrops[i].itemId === "corn") {
                salePrice += stalkPrice;
            } else {
                salePrice += 2;
            }
            idsToDelete.push(sortedCrops[i].id);
        }
        await sellItems(interaction, salePrice, idsToDelete);
        if (stalkUser) {
            updateGarden(interaction, stalkUser, idsToDelete.length);
        } else {
            updateGarden(interaction);
        }
    } else {
        const cropToSell = cropData.filter((c) => c.itemId === itemId);
        const idPrefix =
            interactionData[0] === "sellStalks"
                ? `sellStalks-${interactionData[1]}`
                : `sellChoice-${itemId}`;
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(
                    `How many ${cropEmoji[itemId]} would you like to sell?`
                ),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-1`)
                        .setLabel("1")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(cropToSell.length < 1),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-2`)
                        .setLabel("2")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(cropToSell.length < 2),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-3`)
                        .setLabel("3")
                        .setDisabled(cropToSell.length < 3)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-4`)
                        .setLabel("4")
                        .setDisabled(cropToSell.length < 4)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-5`)
                        .setLabel("5")
                        .setDisabled(cropToSell.length < 5)
                        .setStyle(ButtonStyle.Primary)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-10`)
                        .setLabel("10")
                        .setDisabled(cropToSell.length < 10)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-20`)
                        .setLabel("20")
                        .setDisabled(cropToSell.length < 20)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`${idPrefix}-all`)
                        .setLabel("Sell all")
                        .setDisabled(cropToSell.length < 1)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(
                            interactionData[0] === "sellStalks"
                                ? `main-${stalkUser}`
                                : "sell"
                        )
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
        });
    }
};

const harvestChooserHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const cropData = gardenData.data.filter(
        (i) => i.x !== 0 && i.y !== 0 && crops.includes(i.itemId)
    );
    if (cropData.length === 0) {
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(`You have no crops to harvest!`),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else {
        let interactionData;
        let x = "none";
        let y = "none";
        interactionData = interaction.customId.split("-");
        y = interactionData[1];
        x = interactionData[2];
        let harvestAtCoordinates = false;
        harvestAtCoordinates = gardenData.data.find(
            (i) => i.x === parseInt(x) && i.y === parseInt(y) && i.quantity > 1
        );
        const hasHarvest = gardenData.data.some(
            (i) => i.x > 0 && i.y > 0 && i.quantity > 1
        );
        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`Select a tile to harvest`)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-1-${x}-y`)
                        .setLabel("A")
                        .setStyle(
                            y == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-2-${x}-y`)
                        .setLabel("B")
                        .setStyle(
                            y == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-3-${x}-y`)
                        .setLabel("C")
                        .setStyle(
                            y == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-4-${x}-y`)
                        .setLabel("D")
                        .setStyle(
                            y == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-5-${x}-y`)
                        .setLabel("E")
                        .setStyle(
                            y == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-${y}-1-x`)
                        .setLabel("1")
                        .setStyle(
                            x == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-${y}-2-x`)
                        .setLabel("2")
                        .setStyle(
                            x == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-${y}-3-x`)
                        .setLabel("3")
                        .setStyle(
                            x == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-${y}-4-x`)
                        .setLabel("4")
                        .setStyle(
                            x == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`harvestCoord-${y}-5-x`)
                        .setLabel("5")
                        .setStyle(
                            x == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`harvestAt-${y}-${x}`)
                        .setLabel("Harvest")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(Boolean(!harvestAtCoordinates)),
                    new ButtonBuilder()
                        .setCustomId(`harvestAt-all`)
                        .setLabel("Harvest All")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(Boolean(!hasHarvest))
                ),
            ],
        });
    }
};

const waterChooserHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const cropData = gardenData.data.filter(
        (i) => i.x !== 0 && i.y !== 0 && crops.includes(i.itemId)
    );
    const water = gardenData.data.find((i) => i.itemId === "water");
    if (cropData.length === 0) {
        interaction.update({
            embeds: [
                new EmbedBuilder().setTitle(`You have no crops to water!`),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else if (water.quantity == 0) {
        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`You have no water!`)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    } else {
        let interactionData;
        let x = "none";
        let y = "none";
        interactionData = interaction.customId.split("-");
        y = interactionData[1];
        x = interactionData[2];
        const cropAtCoordinates = gardenData.data.find(
            (i) =>
                i.x === parseInt(x) &&
                i.y === parseInt(y) &&
                crops.includes(i.itemId) &&
                !i.watered &&
                i.quantity < 5
        );
        const allCropsToWater = gardenData.data.filter(
            (i) =>
                i.x > 0 &&
                i.y > 0 &&
                crops.includes(i.itemId) &&
                !i.watered &&
                i.quantity < 5
        );
        const water = gardenData.data.find((i) => i.itemId === "water");
        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`Select a tile to water`)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-1-${x}-y`)
                        .setLabel("A")
                        .setStyle(
                            y == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-2-${x}-y`)
                        .setLabel("B")
                        .setStyle(
                            y == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-3-${x}-y`)
                        .setLabel("C")
                        .setStyle(
                            y == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-4-${x}-y`)
                        .setLabel("D")
                        .setStyle(
                            y == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-5-${x}-y`)
                        .setLabel("E")
                        .setStyle(
                            y == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-${y}-1-x`)
                        .setLabel("1")
                        .setStyle(
                            x == "1"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-${y}-2-x`)
                        .setLabel("2")
                        .setStyle(
                            x == "2"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-${y}-3-x`)
                        .setLabel("3")
                        .setStyle(
                            x == "3"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-${y}-4-x`)
                        .setLabel("4")
                        .setStyle(
                            x == "4"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        ),
                    new ButtonBuilder()
                        .setCustomId(`waterCoord-${y}-5-x`)
                        .setLabel("5")
                        .setStyle(
                            x == "5"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("main")
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`waterAt-${y}-${x}`)
                        .setLabel("Water")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(Boolean(!cropAtCoordinates)),
                    new ButtonBuilder()
                        .setCustomId(`waterAt-all`)
                        .setLabel("Water All")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(
                            allCropsToWater.length === 0 ||
                                allCropsToWater.length >= water.quantity
                        )
                ),
            ],
        });
    }
};

const harvestAtHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const harvestCoords = interaction.customId.split("-");
    const y = harvestCoords[1];
    const x = harvestCoords[2];
    let itemsToHarvest;
    if (y == "all") {
        itemsToHarvest = gardenData.data.filter(
            (i) => i.x !== 0 && i.y !== 0 && crops.includes(i.itemId)
        );
    } else {
        itemsToHarvest = gardenData.data.filter(
            (i) => i.x === parseInt(x) && i.y === parseInt(y)
        );
    }
    await harvestItems(itemsToHarvest);
    updateGarden(interaction);
};

const waterAtHandler = async (interaction) => {
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const harvestCoords = interaction.customId.split("-");
    const y = harvestCoords[1];
    const x = harvestCoords[2];
    let itemsToWater;
    if (y == "all") {
        itemsToWater = gardenData.data.filter(
            (i) =>
                i.x !== 0 &&
                i.y !== 0 &&
                crops.includes(i.itemId) &&
                !i.watered &&
                i.quantity < 5
        );
    } else {
        itemsToWater = gardenData.data.filter(
            (i) => i.x === parseInt(x) && i.y === parseInt(y)
        );
    }
    await waterItems(itemsToWater);
    updateGarden(interaction);
};

const helpHandler = async (interaction) => {
    interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("RPHQ Garden Help")
                .setDescription(
                    "RPHQ Garden is a game where you manage your own virtual garden! The following actions are available:"
                )
                .setFields(
                    {
                        name: "Plant",
                        value: "Plant crops - :green_apple::blueberries::cherries::corn::grapes::lemon::peach: - and watch them grow! Your crops will grow a little bit each day, until they have grown 5 fruit. Crops grow faster if you water them.",
                    },
                    {
                        name: "Harvest",
                        value: "Harvest your crops to transfer them to your inventory. If you take too long (3 days after fully grown, or 3 days after harvesting) your crops will wither.",
                    },
                    {
                        name: "Water",
                        value: "Water your crops and they will grow faster.  You earn 1 water for every 1,000 characters written on the server. Characters written in roleplay channels count 3x.",
                    },
                    {
                        name: "Buy",
                        value: "Buy crops to plant - crops cost :coin:**10** each.",
                    },
                    {
                        name: "Sell",
                        value: "Sell crops for coins - crops sell for :coin:**2**, except for :corn:. Corn is sold on the Stalk Market, and each farm has a different stalk price every day.  Check your friends' gardens every day for the best price!",
                    },
                    {
                        name: "Trade",
                        value: "Offer a trade to other users.  When users visit your farm, they'll see your trade and can choose to accept it.",
                    }
                ),
        ],
        ephemeral: true,
    });
};

const addItem = (garden, x, y, item) => {
    let tile1 = emoji.empty;
    let tile2 = emoji.empty;
    let tile3 = emoji.empty;
    let tile4 = emoji.empty;
    if (item) {
        const i =
            items[
                `${item.itemId}${item.quantity == null ? "" : item.quantity}`
            ];
        tile1 = i[0];
        tile2 = i[1];
        tile3 = i[2];
        if (item.watered) {
            if (
                ["green_apple", "cherries", "lemon", "peach"].includes(
                    item.itemId
                ) &&
                item.quantity !== 0
            ) {
                tile4 = emoji.treewatered;
            } else {
                tile4 = emoji.vinewatered;
            }
        } else {
            tile4 = i[3];
        }
    }
    garden[y * 2 - 1][x * 2 - 1] = tile1;
    garden[y * 2 - 1][x * 2] = tile2;
    garden[y * 2][x * 2 - 1] = tile3;
    garden[y * 2][x * 2] = tile4;
    return garden;
};

const generateGarden = (gardenData) => {
    const row1 = [
        ":blue_square:",
        emoji.one1,
        emoji.one2,
        emoji.two1,
        emoji.two2,
        emoji.three1,
        emoji.three2,
        emoji.four1,
        emoji.four2,
        emoji.five1,
        emoji.five2,
    ];
    let row2 = [emoji.a1];
    let row3 = [emoji.a2];
    let row4 = [emoji.b1];
    let row5 = [emoji.b2];
    let row6 = [emoji.c1];
    let row7 = [emoji.c2];
    let row8 = [emoji.d1];
    let row9 = [emoji.d2];
    let row10 = [emoji.e1];
    let row11 = [emoji.e2];
    let garden = [
        row1,
        row2,
        row3,
        row4,
        row5,
        row6,
        row7,
        row8,
        row9,
        row10,
        row11,
    ];
    for (let x = 1; x <= 5; x++) {
        for (let y = 1; y <= 5; y++) {
            const item = gardenData.find((i) => i.x == x && i.y == y);
            if (item) {
                garden = addItem(garden, x, y, item);
            } else {
                garden = addItem(garden, x, y, false);
            }
        }
    }
    return garden.map((r) => r.join("")).join("\n");
};

const generateItems = (gardenData) => {
    let itemString = "";
    let waterAmt = 0;
    let coinAmt = 0;
    const groupedGardenData = groupGardenData(gardenData);
    groupedGardenData
        .filter((i) => i.x === 0 && i.y === 0)
        .forEach((i) => {
            if (i.itemId === "water") {
                waterAmt = i.quantity;
            } else if (i.itemId === "coins") {
                coinAmt = i.quantity;
            } else {
                if (i.quantity > 0) {
                    itemString += `:${i.itemId}:**${i.quantity}** `;
                }
            }
        });
    return `${itemString}:droplet:**${waterAmt}** :coin:**${coinAmt}**`;
};

const controls = async (user, interaction, gardenData, tradeData) => {
    if (user) {
        const interactionUsersGarden = await getOrCreateGarden(
            interaction.guildId,
            interaction.user.id,
            true
        );
        const groupedIGardenData = groupGardenData(interactionUsersGarden.data);
        let canSatisfyTrade = false;
        if (tradeData) {
            if (tradeData.exchangeItem === "nothing") {
                canSatisfyTrade = true;
            } else {
                const tradeItem = groupedIGardenData.find(
                    (i) =>
                        i.x === 0 &&
                        (i.y === 0) & (i.itemId === tradeData.exchangeItem)
                );
                canSatisfyTrade =
                    tradeData.tradeItem &&
                    tradeItem.quantity >= tradeData.exchangeAmount;
            }
        }

        const userControls = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sellStalks-${user.id}`)
                .setLabel("Stalk Market")
                .setStyle(ButtonStyle.Primary)
        );
        if (tradeData) {
            userControls.addComponents(
                new ButtonBuilder()
                    .setCustomId(`acceptTrd-${user.id}-${interaction.user.id}`)
                    .setLabel("Accept Trade")
                    .setDisabled(!canSatisfyTrade)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        return [userControls];
    } else {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("plant")
                    .setLabel("Plant")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("harvest")
                    .setLabel("Harvest")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("water")
                    .setLabel("Water")
                    .setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("buy")
                    .setLabel("Buy")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("sell")
                    .setLabel("Sell")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("trade")
                    .setLabel("Trade")
                    .setStyle(ButtonStyle.Primary)
            ),
        ];
    }
};

const acceptTradeHandler = async (interaction) => {
    const [command, tradeUser, exchangeUser] = interaction.customId.split("-");
    const trade = await getTrade(interaction.guildId, tradeUser);
    const tradeUserGarden = await getOrCreateGarden(
        interaction.guildId,
        tradeUser,
        true
    );
    const groupedTradeUserGardenData = groupGardenData(tradeUserGarden.data);
    let tradeUserItem = true;
    if (trade.tradeItem !== "nothing") {
        tradeUserItem = groupedTradeUserGardenData.find(
            (i) => i.x === 0 && i.y === 0 && i.itemId === trade.tradeItem
        );
    }
    const exchangeUserGarden = await getOrCreateGarden(
        interaction.guildId,
        exchangeUser,
        true
    );
    const groupedExchangeUserGardenData = groupGardenData(
        exchangeUserGarden.data
    );
    let exchangeUserItem = true;
    if (trade.exchangeItem !== "nothing") {
        exchangeUserItem = groupedExchangeUserGardenData.find(
            (i) => i.x === 0 && i.y === 0 && i.itemId === trade.exchangeItem
        );
    }
    if (
        (trade.tradeTarget === "all" || trade.tradeTarget === exchangeUser) &&
        tradeUserItem &&
        (tradeUserItem === true ||
            tradeUserItem.quantity >= trade.tradeAmount) &&
        exchangeUserItem &&
        (exchangeUserItem === true ||
            exchangeUserItem.quantity >= trade.exchangeAmount)
    ) {
        await tradeItems(trade, exchangeUser);
        updateGarden(interaction, tradeUser, false, true);
    } else {
        interaction.update({
            embeds: [new EmbedBuilder().setTitle(`Trade invalid.`)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`main-${tradeUser}`)
                        .setLabel("Go back")
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
            ephemeral: true,
        });
    }
};

const tradeHandler = async (interaction) => {
    const params = interaction.customId.split("-");
    switch (params.length) {
        // who you're trading with
        case 1:
            tradeStepOne(interaction);
            break;
        // what you're trading
        case 2:
            tradeStepTwo(interaction);
            break;
        // how much you're trading
        case 3:
            tradeStepThree(interaction);
            break;
        // what you're asking for
        case 4:
            tradeStepFour(interaction);
            break;
        // how much you're asking for
        case 5:
            tradeStepFive(interaction);
            break;
        // save the trade
        case 6:
            tradeStepSix(interaction);
            break;
    }
};

const tradeStepOne = async (interaction) => {
    interaction.update({
        embeds: [
            new EmbedBuilder().setTitle(`Who would you like to trade with?`),
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId("trade-user")
                    .setPlaceholder("Select a user")
                    .setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`trade-all`)
                    .setLabel("Any user")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`main`)
                    .setLabel("Go back")
                    .setStyle(ButtonStyle.Primary)
            ),
        ],
    });
};

const tradeStepTwo = async (interaction) => {
    let idPrefix = "trade-all";
    if (interaction.users) {
        idPrefix = `trade-${interaction.users.at(0).id}`;
    }
    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const groupedGardenData = groupGardenData(gardenData.data);
    let tradeData = groupedGardenData.filter(
        (i) => i.x == 0 && i.y == 0 && crops.includes(i.itemId)
    );
    let coins = groupedGardenData.find((i) => i.itemId === "coins");
    if (coins.quantity > 0) {
        tradeData.push({
            itemId: "coins",
        });
    }
    tradeData.push({
        itemId: "nothing",
    });
    let buttons = [[]];
    for (let i = 0; i < tradeData.length; i++) {
        let thisButton = new ButtonBuilder()
            .setCustomId(`${idPrefix}-${tradeData[i].itemId}`)
            .setStyle(ButtonStyle.Primary);
        if (itemEmoji[tradeData[i].itemId]) {
            thisButton.setEmoji(itemEmoji[tradeData[i].itemId]);
        } else {
            thisButton.setCustomId(`${idPrefix}-${tradeData[i].itemId}-0`);
            thisButton.setLabel("Nothing");
        }
        buttons[buttons.length - 1].push(thisButton);
        if (buttons[buttons.length - 1].length == 5) {
            buttons.push([]);
        }
        if (i + 1 === tradeData.length) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`trade`)
                    .setLabel("Go back")
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    interaction.update({
        embeds: [new EmbedBuilder().setTitle(`What would you like to trade?`)],
        components: buttons.map((b) => {
            return new ActionRowBuilder().addComponents(b);
        }),
    });
};

const tradeStepThree = async (interaction) => {
    const [command, tradeTarget, tradeItem] = interaction.customId.split("-");

    const gardenData = await getOrCreateGarden(
        interaction.guildId,
        interaction.user.id
    );
    const groupedGardenData = groupGardenData(gardenData.data);
    let tradeItemData = groupedGardenData.find(
        (i) => i.x == 0 && i.y == 0 && i.itemId === tradeItem
    );

    let quantitiesArray = [1, 2, 3, 4, 5, 10, 20, 40];
    if (tradeItem === "coins") {
        quantitiesArray = quantitiesArray.map((i) => i * 10);
    }
    let buttons = [[]];
    for (let i = 0; i < quantitiesArray.length; i++) {
        let thisButton = new ButtonBuilder()
            .setCustomId(`${interaction.customId}-${quantitiesArray[i]}`)
            .setStyle(ButtonStyle.Primary)
            .setLabel(`${quantitiesArray[i]}`)
            .setDisabled(tradeItemData.quantity < quantitiesArray[i]);
        buttons[buttons.length - 1].push(thisButton);
        if (buttons[buttons.length - 1].length == 5) {
            buttons.push([]);
        }
        if (i + 1 === quantitiesArray.length) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`${command}-${tradeTarget}`)
                    .setLabel("Go back")
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    interaction.update({
        embeds: [
            new EmbedBuilder().setTitle(
                `How many ${itemEmoji[tradeItem]} would you like to trade?`
            ),
        ],
        components: buttons.map((b) => {
            return new ActionRowBuilder().addComponents(b);
        }),
    });
};

const tradeStepFour = async (interaction) => {
    const [command, tradeTarget, tradeItem, tradeAmount] =
        interaction.customId.split("-");
    let buttons = [[]];
    const itemEmojiKeys = Object.keys(itemEmoji);
    for (let i = 0; i < itemEmojiKeys.length; i++) {
        let thisButton = new ButtonBuilder()
            .setCustomId(`${interaction.customId}-${itemEmojiKeys[i]}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(itemEmoji[itemEmojiKeys[i]]);
        buttons[buttons.length - 1].push(thisButton);
        if (buttons[buttons.length - 1].length == 5) {
            buttons.push([]);
        }
        if (i + 1 === itemEmojiKeys.length) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`${interaction.customId}-nothing-0`)
                    .setLabel("Nothing")
                    .setStyle(ButtonStyle.Primary)
            );
            if (buttons[buttons.length - 1].length == 5) {
                buttons.push([]);
            }
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(`${command}-${tradeTarget}-${tradeItem}`)
                    .setLabel("Go back")
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    interaction.update({
        embeds: [new EmbedBuilder().setTitle(`What would you like in return?`)],
        components: buttons.map((b) => {
            return new ActionRowBuilder().addComponents(b);
        }),
    });
};

const tradeStepFive = async (interaction) => {
    const [command, tradeTarget, tradeItem, tradeAmount, exchangeItem] =
        interaction.customId.split("-");

    let quantitiesArray = [1, 2, 3, 4, 5, 10, 20, 40];
    if (exchangeItem === "coins") {
        quantitiesArray = quantitiesArray.map((i) => i * 10);
    }
    let buttons = [[]];
    for (let i = 0; i < quantitiesArray.length; i++) {
        let thisButton = new ButtonBuilder()
            .setCustomId(`${interaction.customId}-${quantitiesArray[i]}`)
            .setStyle(ButtonStyle.Primary)
            .setLabel(`${quantitiesArray[i]}`);
        buttons[buttons.length - 1].push(thisButton);
        if (buttons[buttons.length - 1].length == 5) {
            buttons.push([]);
        }
        if (i + 1 === quantitiesArray.length) {
            buttons[buttons.length - 1].push(
                new ButtonBuilder()
                    .setCustomId(
                        `${command}-${tradeTarget}-${tradeItem}-${tradeAmount}`
                    )
                    .setLabel("Go back")
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    interaction.update({
        embeds: [
            new EmbedBuilder().setTitle(
                `How many ${itemEmoji[exchangeItem]} would you like in return?`
            ),
        ],
        components: buttons.map((b) => {
            return new ActionRowBuilder().addComponents(b);
        }),
    });
};

const tradeStepSix = async (interaction) => {
    await upsertTrade(interaction);
    updateGarden(interaction);
};

const gardenHandler = async (interaction) => {
    let user = await interaction.options.get("user");
    let gardenUser = user?.user || interaction.user;
    let gardenData = await getOrCreateGarden(
        interaction.guildId,
        gardenUser.id,
        Boolean(user?.user)
    );
    if (gardenData) {
        if (gardenData.newGarden) {
            if (!characterCounts[interaction.guildId]) {
                characterCounts[interaction.guildId] = {};
            }
            characterCounts[interaction.guildId][interaction.user.id] = 0;
            await updateCharacterCounts(characterCounts);
            lastCharacterCountUpdate = moment();
        }
        const garden = generateGarden(gardenData.data);
        const items = generateItems(gardenData.data);
        const gardenEmbed = new EmbedBuilder()
            .setTitle(`${gardenUser.username}'s Garden`)
            .setDescription(
                `${garden}
    
${items}`
            );
        const gardenMessage = await interaction.channel.send({
            embeds: [gardenEmbed],
        });
        await addMessage(
            interaction.guildId,
            gardenUser.id,
            interaction.channel.id,
            gardenMessage.id
        );
        let gardenControlsEmbed = [];
        if (user) {
            const stalkPrice = await getStalkPrice(gardenUser.id);
            gardenControlsEmbed = [
                new EmbedBuilder().setTitle(
                    `This farm is buying :corn: from the Stalk Market for :coin:**${stalkPrice}**`
                ),
            ];
        }
        const gardenControlsEmbedData = await insertTradeEmbed(
            gardenControlsEmbed,
            interaction,
            gardenUser.id
        );
        const gardenControls = await controls(
            user?.user,
            interaction,
            gardenData.data,
            gardenControlsEmbedData.trade
        );
        await interaction.reply({
            embeds: gardenControlsEmbedData.gardenControlsEmbed,
            components: gardenControls,
            ephemeral: true,
        });
    } else {
        interaction.reply(
            `**${user.user.username}** does not have a garden yet!`
        );
    }
};

process.on("uncaughtException", async (err) => {
    console.error(
        new Date().toUTCString() + " uncaughtException:",
        err.message
    );
    console.error(err.stack);
    if (
        lastUncaughtException &&
        moment.duration(moment().diff(lastUncaughtException)).asSeconds() <= 10
    ) {
        process.exit(1);
    } else {
        lastUncaughtException = moment();
    }
});

client.login(DISCORDIA_BOT_TOKEN);
