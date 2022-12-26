// this file is for defining our database models
import { Sequelize } from "sequelize";

import { POSTGRES_URI } from "./config.js";

const sequelize = new Sequelize(POSTGRES_URI);

const Character = sequelize.define("character", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: Sequelize.STRING },
    name: { type: Sequelize.STRING },
    avatar: { type: Sequelize.STRING },
});

const RoleplayFilter = sequelize.define("roleplay_filter", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    discordId: { type: Sequelize.STRING },
    guildId: { type: Sequelize.STRING },
    type: { type: Sequelize.STRING },
});

const RoleplayLog = sequelize.define("roleplay_log", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    messageId: { type: Sequelize.STRING },
    userId: { type: Sequelize.STRING },
    length: { type: Sequelize.INTEGER },
    createdAt: { type: Sequelize.DATE },
    deletedAt: { type: Sequelize.DATE },
    channelId: { type: Sequelize.STRING },
    guildId: { type: Sequelize.STRING },
});

const Cooldown = sequelize.define("cooldown", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    item: { type: Sequelize.STRING },
    userId: { type: Sequelize.STRING },
    usedAt: { type: Sequelize.DATE },
});

const Counter = sequelize.define("counter", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: Sequelize.STRING },
    userId: { type: Sequelize.STRING },
    count: { type: Sequelize.INTEGER },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
});

const Achievement = sequelize.define("achievement", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    description: { type: Sequelize.STRING },
    roleId: { type: Sequelize.STRING },
    icon: { type: Sequelize.STRING },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
});

const AchievementLog = sequelize.define("achievement_log", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: Sequelize.STRING },
    guildId: { type: Sequelize.STRING },
    achievementId: { type: Sequelize.INTEGER },
    opened: { type: Sequelize.BOOLEAN },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
});

const Action = sequelize.define("action", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: Sequelize.STRING },
    actionType: { type: Sequelize.STRING },
    restrictions: { type: Sequelize.STRING },
    action: { type: Sequelize.STRING },
    reaction: { type: Sequelize.STRING },
});

const ChannelAction = sequelize.define("channel_action", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    channelId: { type: Sequelize.STRING },
    actionId: { type: Sequelize.INTEGER },
});

const Guild = sequelize.define("guild", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: Sequelize.STRING },
    guildName: { type: Sequelize.STRING },
    announceChannelId: { type: Sequelize.STRING },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
    senpaiRoleId: { type: Sequelize.STRING },
    senpaiMuteRoleId: { type: Sequelize.STRING },
    botStatusChannelId: { type: Sequelize.STRING },
    banned: { type: Sequelize.BOOLEAN },
    ignoreThreads: { type: Sequelize.BOOLEAN },
});

const Wotd = sequelize.define(
    "wotd",
    {
        word: { type: Sequelize.STRING, primaryKey: true },
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);

const Color = sequelize.define(
    "color",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        baseColor: { type: Sequelize.STRING },
        rank: { type: Sequelize.STRING },
        roleId: { type: Sequelize.STRING },
        guildId: { type: Sequelize.STRING },
        roleRestriction: { type: Sequelize.STRING },
        default: { type: Sequelize.BOOLEAN },
    },
    {
        timestamps: false,
    }
);

const Category = sequelize.define("category", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    categoryId: { type: Sequelize.STRING },
    type: { type: Sequelize.STRING },
    start: { type: Sequelize.STRING },
    guildId: { type: Sequelize.STRING },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
});

const StickyMessage = sequelize.define(
    "sticky_message",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guildId: { type: Sequelize.STRING },
        channelId: { type: Sequelize.STRING },
        lastMessageId: { type: Sequelize.STRING },
    },
    {
        timestamps: false,
    }
);

const Discordia = sequelize.define(
    "discordia_v2",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.STRING },
        guildId: { type: Sequelize.STRING },
        itemId: { type: Sequelize.STRING },
        x: { type: Sequelize.INTEGER },
        y: { type: Sequelize.INTEGER },
        quantity: { type: Sequelize.INTEGER },
        createdAt: { type: Sequelize.DATE },
        updatedAt: { type: Sequelize.DATE },
        watered: { type: Sequelize.BOOLEAN },
    },
    {
        freezeTableName: true,
    }
);

const DiscordiaTrades = sequelize.define("discordia_v2_trade", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: Sequelize.STRING },
    guildId: { type: Sequelize.STRING },
    tradeTarget: { type: Sequelize.STRING },
    tradeItem: { type: Sequelize.STRING },
    tradeAmount: { type: Sequelize.STRING },
    exchangeItem: { type: Sequelize.STRING },
    exchangeAmount: { type: Sequelize.STRING },
    createdAt: { type: Sequelize.DATE },
    updatedAt: { type: Sequelize.DATE },
});

const DiscordiaMessages = sequelize.define(
    "discordia_v2_message_log",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.STRING },
        guildId: { type: Sequelize.STRING },
        channelId: { type: Sequelize.STRING },
        messageId: { type: Sequelize.STRING },
    },
    {
        timestamps: false,
    }
);

const DiscordiaCharacterCount = sequelize.define(
    "discordia_v2_character_count",
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        json: { type: Sequelize.JSON },
    },
    {
        timestamps: false,
    }
);

RoleplayLog.hasOne(Guild, {
    foreignKey: "guildId",
    sourceKey: "guildId",
});

Action.hasMany(ChannelAction, {
    foreignKey: "actionId",
    sourceKey: "id",
});

AchievementLog.hasOne(Achievement, {
    foreignKey: "id",
    sourceKey: "achievementId",
});

export {
    sequelize,
    Cooldown,
    Counter,
    Character,
    Guild,
    RoleplayFilter,
    RoleplayLog,
    Achievement,
    AchievementLog,
    Action,
    ChannelAction,
    Wotd,
    Color,
    Category,
    StickyMessage,
    Discordia,
    DiscordiaTrades,
    DiscordiaMessages,
    DiscordiaCharacterCount,
};
