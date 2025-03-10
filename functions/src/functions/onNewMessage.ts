import { CloudEvent, logger } from "firebase-functions";
import { MessagePublishedData } from "firebase-functions/pubsub";
import admin from "firebase-admin";

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Represents the data for an incoming message from the push notification
 * @property {string} emailAddress - The email address of the sender
 * @property {string} historyId - The history ID of the message
 */
interface GmailPushData {
    emailAddress: string;
    historyId: string;
}

/**
 * Handles incoming Gmail push notifications and updates the historyId for the user
 * @param {CloudEvent<MessagePublishedData<GmailPushData>>} event - The push notification event
 */
export const onNewMessageFunction = async (event: CloudEvent<MessagePublishedData<GmailPushData>>) => {
    try {
        const data = JSON.parse(Buffer.from(event.data.message.data, 'base64').toString()) as GmailPushData;
        logger.info('Received Gmail push notification', { data });
        const { emailAddress, historyId } = data;
        if (!emailAddress || !historyId) {
            throw new Error('Missing required data in push notification, emailAddress: ' + emailAddress + ' historyId: ' + historyId);
        }
        const db = admin.firestore();
        try {
            logger.info('Creating pending message for later processing', { emailAddress, historyId });
            const pendingMessageRef = db.collection('pending-messages').doc();
            await pendingMessageRef.set({
                emailAddress,
                historyId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                attempts: 0
            });
            logger.info('Created pending message for later processing', {
                emailAddress,
                historyId,
                documentId: pendingMessageRef.id
            });
        } catch (error) {
            logger.error('Error creating pending message document', { emailAddress, historyId });
            throw error;
        }
    } catch (error) {
        logger.error('Error handling Gmail push notification', { error });
    }
}
