import { checkRestrictions, doReactions } from "../logic.js";

import { getActions } from "../dataAccessors.js";

const messageReactionAdd = async (reaction, reactionBy, client) => {
    const actions = await getActions(
        "messageReactionAdd",
        reaction.message.guild.id,
        reaction.emoji.name
    );
    const reactionByMember = await reaction.message.guild.members.fetch(
        reactionBy.id
    );
    actions.forEach(async (action) => {
        if (
            !action.restrictions ||
            (await checkRestrictions({
                client,
                member: reactionByMember,
                object: reaction,
                restrictions: JSON.parse(action.restrictions),
            }))
        ) {
            await doReactions({
                guildId: reaction.message.guild.id,
                client,
                member: reaction.message.member,
                reactionBy,
                reactions: JSON.parse(action.reaction),
            });
        }
    });
};

export { messageReactionAdd };
 