import { channelCreate } from "./channelCreate.js";

const channelUpdate = async (oldChannel, newChannel) => {
    if (oldChannel.parentId !== newChannel.parentId) {
        // if we're moving between categories, wait a moment for the dust to settle and then reorder
        setTimeout(async () => {
            await channelCreate(newChannel);
        }, 1000);
    }
};

export { channelUpdate };
