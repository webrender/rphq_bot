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
} from "./models.js";
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
        og;
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
    console.log(guildInfoCache);
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

export {
    createAchievementLog,
    createCounter,
    createRoleplayFilter,
    createRoleplayLog,
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
    getCharactersWritten,
    getChannelsToCache,
    getCooldown,
    getCounter,
    getGuilds,
    getLeaderboard,
    getRoleplayFilters,
    getSticky,
    getWotd,
    getColors,
    removeTemporaryAchievement,
    removeRoleplayFilter,
    updateCooldown,
    updateCounter,
    updateRoleplayLog,
    updateSticky,
    updateWotd,
    upsertGuild,
    upsertCharacter,
    upsertRoleplayFilter,
};
