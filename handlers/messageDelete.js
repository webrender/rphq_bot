import { updateRoleplayLog } from "../dataAccessors.js";
import { hasRoleplay, stripTupperReplies } from "../logic.js";

const messageDelete = async (message, pendingBotMessages) => {
    // we can't see who has deleted a message, so we need to treat all deletions
    // the same.  create a timeout which will perform the actual deletion.  then,
    // in the pendingBotMessages array, we store an object with the message ID,
    // timeout ID, and message text.  If the message was deleted because Tupper is
    // about to post on behalf of an avatar, we will compare it to the text in this
    // array and use it to update the message instead of deleting it.
    const isRoleplay = await hasRoleplay(message);
    if (isRoleplay) {
        const text = stripTupperReplies(message.content.trim());
        setTimeout(() => {
            // see if this message matches one in pendingBotMessages
            const botMessageIdx = pendingBotMessages.findIndex(
                (m) => text.indexOf(m.text) > -1
            );
            if (botMessageIdx > -1) {
                // if it matches, update the log with the tupper message ID & length
                updateRoleplayLog(
                    {
                        messageId: pendingBotMessages[botMessageIdx].id, // change the ID to reflect the tupper message
                        length: pendingBotMessages[botMessageIdx].text.length, // instead of the user message
                    },
                    {
                        where: {
                            messageId: message.id,
                        },
                    }
                );
            } else {
                // if there's no match, this is a real deletion
                updateRoleplayLog(
                    { deletedAt: new Date().getTime() },
                    { where: { messageId: message.id } }
                );
            }
            // clean up the pending messages array
            for (var i = pendingBotMessages.length - 1; i >= 0; i--) {
                // is the current message
                const isThisMessage =
                    pendingBotMessages[i].id ===
                    pendingBotMessages[botMessageIdx || 0];

                // is an expired message - over 10 seconds old
                const isOldMessage =
                    pendingBotMessages[i].timestamp <= Date.now() / 1000 - 10;

                // if it's this message or an old message, remove from the pendingBotMessages array
                if (isThisMessage || isOldMessage) {
                    pendingBotMessages.splice(i, 1);
                }
            }
        }, 10000);
    }
};

export { messageDelete };
