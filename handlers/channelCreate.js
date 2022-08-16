import { hasRoleplay } from "../logic.js";

const channelCreate = async (channel) => {
    // when we create or update channels, if theyre
    // in roleplay categories, sort them in alphabetical
    // order
    if (await hasRoleplay({ channel })) {
        const siblings = await channel.parent.children.cache;
        const sortedSiblings = siblings
            .filter((c) => c.isTextBased())
            .map(({ name, id, position }) => {
                return {
                    name,
                    id,
                    position,
                };
            })
            .sort((a, b) => {
                return a.position - b.position;
            });
        for (let i = 0; i < sortedSiblings.length; i++) {
            if (sortedSiblings[i].name === "info") {
                // don't sort the info channel, that stays at the top
                continue;
            }
            if (channel.name.localeCompare(sortedSiblings[i].name) === -1) {
                await channel.setPosition(i);
                break;
            } else {
                continue;
            }
        }
    }
};

export { channelCreate };
