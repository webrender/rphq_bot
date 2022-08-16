import { getActions } from "../dataAccessors.js";
import { checkRestrictions, doReactions } from "../logic.js";

const guildMemberRemove = async (member, client) => {
    const actions = await getActions("guildMemberRemove", member.guild.id);
    actions.forEach(async (action) => {
        if (
            !action.restrictions ||
            (await checkRestrictions({
                client,
                member,
                restrictions: JSON.parse(action.restrictions),
            }))
        ) {
            doReactions({
                guildId: member.guild.id,
                client,
                member,
                reactions: JSON.parse(action.reaction),
            });
        }
    });
};

export { guildMemberRemove };
