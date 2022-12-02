import { getActions } from "../dataAccessors.js";
import { checkRestrictions, doReactions, hasRoleplay } from "../logic.js";

const messageDelete = async (message) => {
    if (message.guild) {
        const actions = await getActions("messageDelete", message.guild.id);
        const roleplayData = await hasRoleplay(message);
        actions.forEach(async (action) => {
            if (
                !action.restrictions ||
                (await checkRestrictions({
                    client: message.client,
                    member: message.member || { user: message.author },
                    object: { message },
                    restrictions: JSON.parse(action.restrictions),
                    roleplayData,
                }))
            ) {
                doReactions({
                    guildId: message.guild.id,
                    client: message.client,
                    member: message.member,
                    message,
                    reactions: JSON.parse(action.reaction),
                    roleplayData,
                });
            }
        });
    }
};

export { messageDelete };
