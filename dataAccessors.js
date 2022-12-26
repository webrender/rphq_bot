// this file is for methods that query the database
import Sequelize from "sequelize";
import moment from "moment-timezone";

import {
    sequelize,
    Character,
    RoleplayFilter,
    RoleplayLog,
    Cooldown,
    Counter,
    Achievement,
    AchievementLog,
    Action,
    ChannelAction,
    Guild,
    Wotd,
    Color,
    Category,
    StickyMessage,
    Discordia,
    DiscordiaTrades,
    DiscordiaMessages,
    DiscordiaCharacterCount,
} from "./models.js";
import { groupGardenData } from "./logic.js";
import { LOCALE } from "./config.js";

let roleplayFilterCache = [];
let guildInfoCache = {};

// create a row in the roleplay log
const createRoleplayLog = async (fields) => {
    return RoleplayLog.create(fields);
};

// get config key/value store from DB
const getCooldown = async (item, userId) => {
    const cooldown = await Cooldown.findOne({
        where: {
            item,
            userId,
        },
    });
    return cooldown?.dataValues?.usedAt;
};

// get a leaderboard for a given time period
const getLeaderboard = async (type, guildId, limit = 30) => {
    let start = moment.tz(LOCALE).startOf("day").utc();
    let end = moment.tz(LOCALE).utc();
    switch (type) {
        case "hour":
            if (moment.tz(LOCALE).hour() < 12) {
                start = moment.tz(LOCALE).startOf("day").utc();
                end = moment.tz(LOCALE).startOf("day").add(12, "hours").utc();
            } else {
                start = moment.tz(LOCALE).startOf("day").add(12, "hours").utc();
                end = moment.tz(LOCALE).endOf("day").utc();
            }
            break;
        case "phour":
            if (moment.tz(LOCALE).hour() < 12) {
                start = moment
                    .tz(LOCALE)
                    .subtract(1, "days")
                    .startOf("day")
                    .add(12, "hours")
                    .utc();
                end = moment.tz(LOCALE).subtract(1, "days").endOf("day").utc();
            } else {
                start = moment.tz(LOCALE).startOf("day").utc();
                end = moment.tz(LOCALE).startOf("day").add(12, "hours").utc();
            }
            break;
        case "day":
            // already defined, do nothing
            break;
        case "pday":
            start = moment.tz(LOCALE).subtract(1, "days").startOf("day").utc();
            end = moment.tz(LOCALE).subtract(1, "days").endOf("day").utc();
            break;
        case "week":
            // end is already correct
            start = moment.tz(LOCALE).startOf("week").utc();
            break;
        case "pweek":
            start = moment.tz(LOCALE).subtract(1, "week").startOf("week").utc();
            end = moment.tz(LOCALE).subtract(1, "week").endOf("week").utc();
            break;
        case "month":
            // end is already correct
            start = moment.tz(LOCALE).startOf("month").utc();
            break;
        case "pmonth":
            start = moment
                .tz(LOCALE)
                .subtract(1, "month")
                .startOf("month")
                .utc();
            end = moment.tz(LOCALE).subtract(1, "month").endOf("month").utc();
            break;
    }
    const where = {
        createdAt: {
            [Sequelize.Op.gt]: start.toDate(),
            [Sequelize.Op.lt]: end.toDate(),
        },
        deletedAt: {
            [Sequelize.Op.eq]: null,
        },
    };
    if (guildId) {
        where.guildId = guildId;
    }
    const leaders = await RoleplayLog.findAll({
        attributes: [
            "userId",
            [sequelize.fn("sum", sequelize.col("length")), "totalLength"],
        ],
        where,
        group: ["userId"],
        order: [[sequelize.fn("sum", sequelize.col("length")), "DESC"]],
        limit,
    });
    return leaders;
};

const getCurrencyLeader = async (limit = 20) => {
    const leaders = await RoleplayLog.findAll({
        attributes: [
            "userId",
            // "createdAt",
            [
                sequelize.fn(
                    "count",
                    sequelize.fn("distinct", sequelize.col("channelId"))
                ),
                "dayCount",
            ],
        ],
        group: [
            "userId",
            [sequelize.fn("date_trunc", "day", sequelize.col("createdAt"))],
        ],
    });
    const leaderArray = leaders
        .reduce((p, c) => {
            const idx = p.findIndex((i) => i.userId === c.dataValues.userId);
            if (idx > -1) {
                const newCount = p[idx].count + parseInt(c.dataValues.dayCount);
                p[idx].count = newCount;
            } else {
                p.push({
                    userId: c.dataValues.userId,
                    count: parseInt(c.dataValues.dayCount),
                });
            }
            return p;
        }, [])
        .sort((a, b) => b.count - a.count)
        .filter((i) => i.count != 0)
        .slice(0, 20);
    return leaderArray;
};

// get the list of roleplay channels & categories
const getRoleplayFilters = async () => {
    if (Object.keys(roleplayFilterCache).length === 0) {
        const roleplayFilters = await RoleplayFilter.findAll();
        roleplayFilterCache = roleplayFilters.map((f) => f.dataValues);
    }
    return roleplayFilterCache;
};

const createRoleplayFilter = async (fields) => {
    await RoleplayFilter.create(fields);
    const roleplayFilters = await RoleplayFilter.findAll();
    roleplayFilterCache = roleplayFilters.map((f) => f.dataValues);
    return true;
};

const removeRoleplayFilter = async (id) => {
    await RoleplayFilter.destroy({
        where: {
            id,
        },
    });
    const roleplayFilters = await RoleplayFilter.findAll();
    roleplayFilterCache = roleplayFilters.map((f) => f.dataValues);
    return true;
};

const getChannelsToCache = async () => {
    const channels = await Action.findAll({
        where: { actionType: "messageReactionAdd" },
    });
    let channelArray = [];
    channels.forEach((c) => {
        const restrictions = JSON.parse(c.dataValues.restrictions);
        const channelRestriction = restrictions.find((r) => r[0] === "channel");
        if (
            channelRestriction &&
            !channelArray.includes(channelRestriction[1])
        ) {
            channelArray.push(channelRestriction[1]);
        }
    });
    return channelArray;
};

// update a row in the config key/value store
const updateCooldown = async (update, where, rowExists) => {
    if (rowExists) {
        return Cooldown.update(update, where);
    }
    return Cooldown.create(update);
};

// update a row in the roleplay log
const updateRoleplayLog = async (update, where) => {
    return RoleplayLog.update(update, where);
};

// get a user's achievements
const getUserAchievements = async (userId) => {
    let achievements = await AchievementLog.findAll({
        where: { userId },
        include: Achievement,
        order: [["createdAt", "ASC"]],
    });
    // add the holiday achievement in november
    if (moment().month() === 11) {
        let christmasAchievement = await Achievement.findOne({
            where: { id: 29 },
        });
        const christmasAchievementLog = {
            dataValues: {
                id: 0,
                userId: userId,
                achievementId: 0,
                createdAt: null,
                updatedAt: null,
                achievement: {
                    dataValues: {},
                },
            },
        };
        christmasAchievementLog.dataValues.achievement = christmasAchievement;
        achievements.push(christmasAchievementLog);
    }
    return achievements;
};

// get the list of all achievements
const getAchievements = async (noSpecials) => {
    let response = [];
    // sometimes we don't want to load "special"
    // achievements - these are achievements which
    // are only meant for a single user.
    if (noSpecials) {
        response = await Achievement.findAll({
            where: {
                special: {
                    [Sequelize.Op.eq]: null,
                },
            },
        });
    } else {
        response = await Achievement.findAll();
    }
    return response.map((a) => a.dataValues);
};

// get a single achievement
const getAchievement = async (id) => {
    const achievement = await Achievement.findOne({
        where: { id },
    });
    return achievement.dataValues;
};

// create a new achievement log
const createAchievementLog = async (fields) => {
    const check = await AchievementLog.findOne({
        where: fields,
    });
    if (check) {
        return false;
    } else {
        return AchievementLog.create(fields);
    }
};

// remove a temporary achievement (leaderboard)
const removeTemporaryAchievement = async (achievementId) => {
    return AchievementLog.destroy({
        where: {
            achievementId,
        },
    });
};

// get a users total number of characters written
const getCharactersWritten = async (userId, guildId) => {
    const where = {
        userId,
        deletedAt: {
            [Sequelize.Op.eq]: null,
        },
    };
    if (guildId) {
        where.guildId = guildId;
    }
    const logs = await RoleplayLog.findAll({
        attributes: [
            [sequelize.fn("min", sequelize.col("updatedAt")), "minDate"],
            [sequelize.fn("sum", sequelize.col("length")), "charactersWritten"],
        ],
        where,
        group: [
            sequelize.literal(
                `to_timestamp(floor((extract('epoch' from "updatedAt") / 840 )) * 840)`
            ),
        ],
        order: [[sequelize.literal('"minDate"'), "DESC"]],
    });
    return logs.map((l) => {
        return {
            charactersWritten: l.dataValues.charactersWritten,
            minDate: l.dataValues.minDate,
        };
    });
};

const getGuilds = async (userId) => {
    const guilds = await RoleplayLog.findAll({
        attributes: ["guild.guildName"],
        where: {
            userId,
        },
        include: Guild,
        group: ["roleplay_log.guildId", "guild.id"],
    });
    return guilds.map((g) => g.guild.dataValues.guildName);
};

// get the value of a specific counter for a specific user
const getCounter = async (type, userId) => {
    const counter = await Counter.findOne({
        where: {
            type,
            userId,
        },
    });
    return counter?.dataValues;
};

// create a specific counter for a specific user
const createCounter = async (type, userId) => {
    Counter.create({
        type,
        userId,
        count: 1,
    });
};

// update a specific counter for a specific user
const updateCounter = async (type, userId, count) => {
    Counter.update(
        {
            count,
        },
        {
            where: {
                type,
                userId,
            },
        }
    );
};

const getActiveRoleplays = async (userId, guildId) => {
    const channels = await RoleplayLog.findAll({
        attributes: [
            // [sequelize.fn("distinct", sequelize.col("channelId")), "channelId"],
            // "updatedAt",
            "channelId",
            [sequelize.fn("max", sequelize.col("updatedAt")), "updatedAt"],
        ],
        where: {
            userId,
            guildId,
            channelId: {
                [Sequelize.Op.ne]: null,
            },
            deletedAt: {
                [Sequelize.Op.eq]: null,
            },
            // createdAt: {
            //     [Sequelize.Op.gte]: moment().subtract(2, "week").toDate(),
            // },
        },
        group: ["channelId"],
        order: [[sequelize.literal('"updatedAt"'), "DESC"]],
    });
    return channels.map((c) => c.dataValues);
};

const getGuildInfo = async (guildId) => {
    if (guildInfoCache[guildId]) {
        return guildInfoCache[guildId];
    }
    const guild = await Guild.findOne({
        where: {
            guildId,
        },
    });
    guildInfoCache[guildId] = guild?.dataValues;
    return guildInfoCache[guildId];
};

const getAllGuilds = async () => {
    const guilds = await Guild.findAll();
    return guilds.map((g) => g.dataValues);
};

const getActions = async (actionType, guildId, action) => {
    const where = {
        actionType,
    };
    if (guildId) {
        where.guildId = guildId;
    }
    if (action) {
        where.action = action;
    }
    if (global.actionsCache[JSON.stringify(where)]) {
        return global.actionsCache[JSON.stringify(where)];
    }
    const actions = await Action.findAll({
        where,
    });
    const sortedActions = actions
        .sort((a) => {
            if (
                a.reaction.includes("assignRole") ||
                a.reaction.includes("unassignRole")
            ) {
                return -1;
            }
            return 1;
        })
        .map((a) => a.dataValues);
    global.actionsCache[JSON.stringify(where)] = sortedActions;
    return sortedActions;
};

const getWotd = async () => {
    const word = await Wotd.findOne({});
    return word.dataValues.word;
};

const updateWotd = async (word) => {
    Wotd.update(
        {
            word,
        },
        {
            where: {
                [Sequelize.Op.and]: [Sequelize.literal("1=1")],
            },
        }
    );
    global.wotd = word;
};

const getColors = async (guildId) => {
    const colors = await Color.findAll({
        where: {
            guildId,
        },
    });
    return colors.map((c) => c.dataValues);
};

const getCategories = async (guildId) => {
    if (global.categoryCache[guildId]) {
        return global.categoryCache[guildId];
    }
    const categories = await Category.findAll({
        where: {
            guildId,
        },
    });
    global.categoryCache[guildId] = categories.map((c) => c.dataValues);
    return global.categoryCache[guildId];
};

const getSticky = async (guildId, channelId) => {
    const sticky = await StickyMessage.findOne({
        where: {
            guildId,
            channelId,
        },
    });
    return sticky?.dataValues;
};

const updateSticky = async (guildId, channelId, lastMessageId, id) => {
    if (id) {
        StickyMessage.update(
            {
                lastMessageId,
                guildId,
                channelId,
            },
            {
                where: {
                    id,
                },
            }
        );
    } else {
        StickyMessage.create({
            lastMessageId,
            guildId,
            channelId,
        });
    }
};

const upsertGuild = async (update) => {
    let guild = await Guild.findOne({
        where: {
            guildId: update.guildId,
        },
    });
    if (guild) {
        await Guild.update(update, {
            where: {
                guildId: update.guildId,
            },
        });
    } else {
        await Guild.create(update);
    }
    guild = await Guild.findOne({
        where: {
            guildId: update.guildId,
        },
    });
    guildInfoCache[update.guildId] = guild?.dataValues;
    return guild?.dataValues;
};

const upsertRoleplayFilter = async (update) => {
    let filter = await RoleplayFilter.findOne({
        where: {
            discordId: update.discordId,
        },
    });
    if (filter) {
        await RoleplayFilter.update(update, {
            where: {
                discordId: update.discordId,
            },
        });
    } else {
        await RoleplayFilter.create(update);
    }
    if (roleplayFilterCache.length > 0) {
        roleplayFilterCache = roleplayFilterCache.map((f) => {
            if (f.discordId === update.discordId) {
                f.type = update?.type;
            }
            return f;
        });
    }
    return true;
};

const getCharacter = async (userId) => {
    if (global.characterCache[userId]) {
        return global.characterCache[userId];
    }
    const character = await Character.findOne({
        where: {
            userId,
        },
    });
    if (character?.dataValues) {
        global.characterCache[userId] = character.dataValues;
    }
    return character?.dataValues;
};

const upsertCharacter = async (update) => {
    let filter = await Character.findOne({
        where: {
            userId: update.userId,
        },
    });
    if (filter) {
        await Character.update(update, {
            where: {
                userId: update.userId,
            },
        });
    } else {
        await Character.create(update);
    }
    delete global.characterCache[update.userId];
    return true;
};

const crops = [
    "green_apple",
    "blueberries",
    "cherries",
    "corn",
    "grapes",
    "lemon",
    "peach",
];

const cropEmoji = {
    green_apple: "🍏",
    blueberries: "🫐",
    cherries: "🍒",
    corn: "🌽",
    grapes: "🍇",
    lemon: "🍋",
    peach: "🍑",
};

const itemEmoji = { ...cropEmoji, coins: "🪙" };

const getOrCreateGarden = async (guildId, userId, otherUser) => {
    let gardenItems = await Discordia.findAll({
        where: {
            userId,
            guildId,
        },
    });
    if (!gardenItems.find((i) => i.dataValues.itemId === "house")) {
        if (!otherUser) {
            let remainingCrops = [...crops];
            gardenItems.forEach((i) => {
                const rcIdx = remainingCrops.findIndex(
                    (c) => c === i.dataValues.itemId
                );
                if (rcIdx >= 0) {
                    remainingCrops.splice(rcIdx, 1);
                }
            });
            if (remainingCrops.length === 0) {
                remainingCrops = [...crops];
            }
            const res = [
                { guildId, userId, itemId: "house", x: 3, y: 3 },
                {
                    guildId,
                    userId,
                    itemId: remainingCrops[
                        Math.floor(Math.random() * remainingCrops.length)
                    ],
                    x: 0,
                    y: 0,
                    quantity: 1,
                },
                { guildId, userId, itemId: "coins", x: 0, y: 0, quantity: 0 },
                { guildId, userId, itemId: "water", x: 0, y: 0, quantity: 0 },
            ];
            await Discordia.bulkCreate(res, {
                fields: ["guildId", "userId", "itemId", "x", "y", "quantity"],
            });
            gardenItems = gardenItems.map((a) => a.dataValues).concat(res);
            return {
                data: gardenItems,
                newGarden: true,
            };
        } else {
            return false;
        }
    } else {
        return {
            data: gardenItems.map((a) => a.dataValues),
        };
    }
};

const addToGarden = async (item) => {
    await Discordia.create(item);
    const itemToSubtract = await Discordia.findOne({
        where: {
            itemId: item.itemId,
            x: 0,
            y: 0,
            guildId: item.guildId,
            userId: item.userId,
        },
        order: [["createdAt", "ASC"]],
    });
    if (itemToSubtract) {
        await itemToSubtract.destroy();
    }
};

const buyCrops = async (cropsToBuy) => {
    await Discordia.bulkCreate(cropsToBuy, {
        fields: ["guildId", "userId", "itemId", "x", "y", "quantity"],
    });
    await Discordia.update(
        {
            quantity: Sequelize.literal(`quantity - ${cropsToBuy.length * 10}`),
        },
        {
            where: {
                itemId: "coins",
                userId: cropsToBuy[0].userId,
                guildId: cropsToBuy[0].guildId,
            },
        }
    );
};

const harvestItems = async (items) => {
    let idsToDelete = [];
    let itemsToCreate = [];
    items.forEach((item) => {
        const { guildId, userId, itemId, quantity } = item;
        idsToDelete.push(item.id);
        for (let i = 1; i < quantity; i++) {
            itemsToCreate.push({
                guildId,
                userId,
                itemId,
                x: 0,
                y: 0,
                quantity: 1,
            });
        }
    });
    await Discordia.destroy({
        where: {
            id: idsToDelete,
        },
    });
    await Discordia.bulkCreate(itemsToCreate, {
        fields: ["guildId", "userId", "itemId", "x", "y", "quantity"],
    });
};

const waterItems = async (items) => {
    await Discordia.update(
        {
            watered: true,
        },
        {
            where: {
                id: items.map((i) => i.id),
            },
        }
    );
    await Discordia.update(
        {
            quantity: Sequelize.literal(`quantity - ${items.length}`),
        },
        {
            where: {
                itemId: "water",
                userId: items[0].userId,
                guildId: items[0].guildId,
            },
        }
    );
};

const growCrops = async () => {
    // add 1 crop for all crops under qty 6
    // add a 2nd crop for all crops under stage 6 which are watered
    // unwater watered crops
    // reset 3 day old max-growth crops to stage 1
    // delete harvested crops over 3 days old
    await Discordia.update(
        {
            quantity: Sequelize.literal("quantity + 1"),
        },
        {
            where: {
                x: { [Sequelize.Op.ne]: 0 },
                y: { [Sequelize.Op.ne]: 0 },
                itemId: { [Sequelize.Op.in]: crops },
                quantity: { [Sequelize.Op.lt]: 6 },
            },
        }
    );
    await Discordia.update(
        {
            quantity: Sequelize.literal("quantity + 1"),
        },
        {
            where: {
                x: { [Sequelize.Op.ne]: 0 },
                y: { [Sequelize.Op.ne]: 0 },
                itemId: { [Sequelize.Op.in]: crops },
                quantity: { [Sequelize.Op.lt]: 6 },
                watered: true,
            },
        }
    );
    await Discordia.update(
        {
            watered: false,
        },
        {
            where: {
                watered: true,
            },
        }
    );
    await Discordia.update(
        {
            quantity: 1,
        },
        {
            where: {
                x: { [Sequelize.Op.ne]: 0 },
                y: { [Sequelize.Op.ne]: 0 },
                itemId: { [Sequelize.Op.in]: crops },
                updatedAt: {
                    [Sequelize.Op.lt]: moment().subtract(3, "day").toDate(),
                },
            },
        }
    );
    await Discordia.destroy({
        where: {
            x: 0,
            y: 0,
            itemId: {
                [Sequelize.Op.in]: crops,
            },
            createdAt: {
                [Sequelize.Op.lte]: moment().subtract(3, "day").toDate(),
            },
        },
    });
    process.exit();
};

const sellItems = async (interaction, salePrice, idsToDelete) => {
    await Discordia.destroy({
        where: {
            id: idsToDelete,
        },
    });
    await Discordia.update(
        {
            quantity: Sequelize.literal(`quantity + ${salePrice}`),
        },
        {
            where: {
                itemId: "coins",
                userId: interaction.user.id,
                guildId: interaction.guildId,
            },
        }
    );
};

const upsertTrade = async (interaction) => {
    let trade = await DiscordiaTrades.findOne({
        where: {
            userId: interaction.user.id,
            guildId: interaction.guildId,
        },
    });
    const [
        command,
        tradeTarget,
        tradeItem,
        tradeAmount,
        exchangeItem,
        exchangeAmount,
    ] = interaction.customId.split("-");
    const update = {
        tradeTarget,
        tradeItem,
        tradeAmount,
        exchangeItem,
        exchangeAmount,
    };
    if (tradeAmount === "all") {
        const gardenData = await getOrCreateGarden(
            interaction.guildId,
            interaction.user.id
        );
        const groupedGardenData = groupGardenData(gardenData.data);
        let tradeItemData = groupedGardenData.find(
            (i) => i.x == 0 && i.y == 0 && i.itemId === tradeItem
        );
        update.tradeAmount = tradeItemData.quantity;
    }
    if (trade) {
        await DiscordiaTrades.update(update, {
            where: {
                guildId: interaction.guildId,
                userId: interaction.user.id,
            },
        });
    } else {
        update.guildId = interaction.guildId;
        update.userId = interaction.user.id;
        await DiscordiaTrades.create(update);
    }
    return true;
};

const getTrade = async (guildId, userId) => {
    const trade = await DiscordiaTrades.findOne({
        where: {
            guildId,
            userId,
        },
    });
    const gardenData = await getOrCreateGarden(guildId, userId, true);
    const groupedGardenData = groupGardenData(gardenData.data);
    if (trade) {
        const crop = groupedGardenData.find(
            (i) =>
                i.x === 0 &&
                i.y === 0 &&
                i.itemId === trade.dataValues.tradeItem
        );
        if (!crop || crop.quantity < parseInt(trade.dataValues.tradeAmount)) {
            await DiscordiaTrades.destroy({
                where: {
                    guildId,
                    userId,
                },
            });
            return null;
        } else {
            return trade.dataValues;
        }
    } else {
        return null;
    }
};

const tradeItems = async (trade, exchangeUser) => {
    // find the oldest n trade items and reassign the user
    if (trade.tradeItem !== "nothing") {
        const tradeItems = await Discordia.findAll({
            where: {
                guildId: trade.guildId,
                userId: trade.userId,
                itemId: trade.tradeItem,
                x: 0,
                y: 0,
            },
            limit: trade.tradeAmount,
            order: [["createdAt", "ASC"]],
        });
        if (trade.tradeItem === "coins") {
            await Discordia.update(
                {
                    quantity: Sequelize.literal(
                        `quantity - ${trade.tradeAmount}`
                    ),
                },
                {
                    where: {
                        id: tradeItems[0].dataValues.id,
                    },
                }
            );
            await Discordia.update(
                {
                    quantity: Sequelize.literal(
                        `quantity + ${trade.tradeAmount}`
                    ),
                },
                {
                    where: {
                        guildId: trade.guildId,
                        userId: exchangeUser,
                        itemId: "coins",
                    },
                }
            );
        } else {
            await Discordia.update(
                {
                    userId: exchangeUser,
                },
                {
                    where: {
                        id: {
                            [Sequelize.Op.in]: tradeItems.map(
                                (i) => i.dataValues.id
                            ),
                        },
                    },
                }
            );
        }
    }
    // find the oldest n exchange items and reassign the user
    if (trade.exchangeItem !== "nothing") {
        const exchangeItems = await Discordia.findAll({
            where: {
                guildId: trade.guildId,
                userId: exchangeUser,
                itemId: trade.exchangeItem,
                x: 0,
                y: 0,
            },
            limit: trade.exchangeAmount,
            order: [["createdAt", "ASC"]],
        });
        if (trade.exchangeItem === "coins") {
            await Discordia.update(
                {
                    quantity: Sequelize.literal(
                        `quantity - ${trade.exchangeAmount}`
                    ),
                },
                {
                    where: {
                        id: exchangeItems[0].dataValues.id,
                    },
                }
            );
            await Discordia.update(
                {
                    quantity: Sequelize.literal(
                        `quantity + ${trade.exchangeAmount}`
                    ),
                },
                {
                    where: {
                        guildId: trade.guildId,
                        userId: trade.userId,
                        itemId: "coins",
                    },
                }
            );
        } else {
            await Discordia.update(
                {
                    userId: trade.userId,
                },
                {
                    where: {
                        id: {
                            [Sequelize.Op.in]: exchangeItems.map(
                                (i) => i.dataValues.id
                            ),
                        },
                    },
                }
            );
        }
    }
    // delete the trade
    await DiscordiaTrades.destroy({
        where: {
            id: trade.id,
        },
    });
    return true;
};

const getMessages = async (guildId, userId) => {
    const messages = await DiscordiaMessages.findAll({
        where: {
            guildId,
            userId,
        },
        limit: 5,
        order: [["id", "DESC"]],
    });
    DiscordiaMessages.destroy({
        where: {
            id: {
                [Sequelize.Op.notIn]: messages.map((m) => m.dataValues.id),
            },
        },
    });
    return messages.map((m) => m.dataValues);
};

const addMessage = async (guildId, userId, channelId, messageId) => {
    await DiscordiaMessages.create({
        guildId,
        userId,
        channelId,
        messageId,
    });
};

const getCharacterCounts = async () => {
    const characterCountData = await DiscordiaCharacterCount.findOne();
    let characterCounts = {};
    if (characterCountData) {
        characterCounts = characterCountData.dataValues.json;
    }
    const gardens = await Discordia.findAll({
        where: {
            itemId: "house",
        },
    });
    for (const garden of gardens) {
        const { userId, guildId } = garden.dataValues;
        if (!characterCounts[guildId]) {
            characterCounts[guildId] = {};
        }
        if (!characterCounts[guildId][userId]) {
            characterCounts[guildId][userId] = 0;
        }
    }
    return characterCounts;
};

const updateCharacterCounts = async (characterCountData) => {
    DiscordiaCharacterCount.update(
        {
            json: characterCountData,
        },
        {
            where: {},
        }
    );
};

const increaseWater = async (guildId, userId, numWaterToAdd) => {
    const currentWater = await Discordia.findOne({
        where: {
            guildId,
            userId,
            itemId: "water",
        },
    });
    const currentWaterVal = currentWater.dataValues.quantity;
    if (currentWaterVal < 25) {
        let updatedValue;
        if (currentWaterVal + numWaterToAdd > 25) {
            updatedValue = 25;
        } else {
            updatedValue = currentWaterVal + numWaterToAdd;
        }
        await Discordia.update(
            {
                quantity: updatedValue,
            },
            {
                where: {
                    guildId,
                    userId,
                    itemId: "water",
                },
            }
        );
    }
};

const openGifts = async (guildId, userId) => {
    const unopenedGifts = await AchievementLog.findAll({
        where: {
            userId,
            guildId,
            achievementId: {
                [Sequelize.Op.in]: [30, 50],
            },
            opened: {
                [Sequelize.Op.not]: true,
            },
        },
    });
    if (unopenedGifts.length > 0) {
        let cropChoices = [...crops];
        let chosenCrops = [];
        for (let i = 0; i < unopenedGifts.length; i++) {
            const rand = Math.floor(Math.random() * cropChoices.length);
            const itemId = cropChoices[rand];
            chosenCrops.push(itemEmoji[cropChoices[rand]]);
            const createObj = {
                guildId,
                userId,
                itemId,
                x: 0,
                y: 0,
                quantity: 1,
            };
            cropChoices.pop(rand, 1);
            await Discordia.bulkCreate([createObj, createObj, createObj], {
                fields: ["guildId", "userId", "itemId", "x", "y", "quantity"],
            });
        }
        AchievementLog.update(
            {
                opened: true,
            },
            {
                where: {
                    id: {
                        [Sequelize.Op.in]: unopenedGifts.map(
                            (i) => i.dataValues.id
                        ),
                    },
                },
            }
        );
        return chosenCrops;
    } else {
        return false;
    }
};

export {
    addToGarden,
    addMessage,
    buyCrops,
    createAchievementLog,
    createCounter,
    createRoleplayFilter,
    createRoleplayLog,
    crops,
    cropEmoji,
    getAchievement,
    getAchievements,
    getActions,
    getActiveRoleplays,
    getAllGuilds,
    getCategories,
    getCharacter,
    getCurrencyLeader,
    getGuildInfo,
    getUserAchievements,
    getCharacterCounts,
    getCharactersWritten,
    getChannelsToCache,
    getCooldown,
    getCounter,
    getGuilds,
    getLeaderboard,
    getMessages,
    getRoleplayFilters,
    getSticky,
    getWotd,
    getColors,
    getOrCreateGarden,
    getTrade,
    growCrops,
    harvestItems,
    itemEmoji,
    increaseWater,
    openGifts,
    removeTemporaryAchievement,
    removeRoleplayFilter,
    sellItems,
    tradeItems,
    updateCharacterCounts,
    updateCooldown,
    updateCounter,
    updateRoleplayLog,
    updateSticky,
    updateWotd,
    upsertGuild,
    upsertCharacter,
    upsertRoleplayFilter,
    upsertTrade,
    waterItems,
};
