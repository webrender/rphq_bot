import { updateRoleplayLog } from "../dataAccessors.js";
import { hasRoleplay } from "../logic.js";

const messageUpdate = async (oldMessage, newMessage) => {
    // when a roleplay message is updated, we should update the DB
    // with the new length
    const isRoleplay = await hasRoleplay(oldMessage);
    if (isRoleplay) {
        const trimmedText = newMessage.content.trim();
        updateRoleplayLog(
            { length: trimmedText.length },
            { where: { messageId: oldMessage.id } }
        );
    }
};

export { messageUpdate };
