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

let characterCache = {};
let roleplayFilterCache = {};

// create a row in the roleplay log
const createRoleplayLog = async (fields) => {
    return RoleplayLog.create(fields);
};

// find all tupper-esque characters for a user
const getCharacters = async (message) => {
    if (!characterCache[message.author.id]) {
        const characters = await Character.findAll({
            where: { owner: message.author.id },
        });
        characterCache[message.author.id] = characters.map((c) => c.dataValues);
    }

    return characterCache[message.author.id];
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
const getLeaderboard = async (type, limit = 30) => {
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

    const leaders = await RoleplayLog.findAll({
        attributes: [
            "userId",
            [sequelize.fn("sum", sequelize.col("length")), "totalLength"],
        ],
        where: {
            createdAt: {
                [Sequelize.Op.gt]: start.toDate(),
                [Sequelize.Op.lt]: end.toDate(),
            },
            deletedAt: {
                [Sequelize.Op.eq]: null,
            },
        },
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

const getChannelsToCache = async () => {
    const channels = await Action.findAll({
        where: { actionType: "messageReactionAdd" },
        include: ChannelAction,
    });
    const channelArrays = channels.map((c) =>
        c.dataValues.channel_actions.map((a) => a.dataValues.channelId)
    );
    return new Set(channelArrays.flat(1));
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
const getCharactersWritten = async (userId) => {
    const logs = await RoleplayLog.findAll({
        attributes: [
            [sequelize.fn("min", sequelize.col("updatedAt")), "minDate"],
            [sequelize.fn("sum", sequelize.col("length")), "charactersWritten"],
        ],
        where: {
            userId,
            deletedAt: {
                [Sequelize.Op.eq]: null,
            },
        },
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

const getActiveRoleplays = async (userId) => {
    const channels = await RoleplayLog.findAll({
        attributes: [
            // [sequelize.fn("distinct", sequelize.col("channelId")), "channelId"],
            // "updatedAt",
            "channelId",
            [sequelize.fn("max", sequelize.col("updatedAt")), "updatedAt"],
        ],
        where: {
            userId,
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
    const guild = await Guild.findOne({
        where: {
            guildId,
        },
    });
    return guild?.dataValues;
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

export {
    createAchievementLog,
    createCounter,
    createRoleplayLog,
    getAchievement,
    getAchievements,
    getActions,
    getActiveRoleplays,
    getAllGuilds,
    getCategories,
    getCurrencyLeader,
    getGuildInfo,
    getUserAchievements,
    getCharacters,
    getCharactersWritten,
    getChannelsToCache,
    getCooldown,
    getCounter,
    getLeaderboard,
    getRoleplayFilters,
    getSticky,
    getWotd,
    getColors,
    removeTemporaryAchievement,
    updateCooldown,
    updateCounter,
    updateRoleplayLog,
    updateSticky,
    updateWotd,
};
