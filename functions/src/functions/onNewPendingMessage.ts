import { getMessage } from "../helpers/gmail";
import { logger } from "firebase-functions/v2";
import { getLatestMessages } from "../helpers/gmail";
import { processAndStoreEmail } from "../helpers/db";
import admin from "firebase-admin";
import { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

export const onNewPendingMessageFunction = async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, any>) => {
    try {
        logger.info('Handling new pending message', { documentId: event.data?.id });
        const data = event.data?.data();
        const emailAddress = data?.emailAddress;
        const historyId = data?.historyId;
        if (!emailAddress || !historyId) {
            logger.error('Missing required data in pending message document', { snapshot: data });
            try {
                await event.data?.ref.update({
                    status: 'error',
                    errorMessage: 'Missing required data in pending message document ' + JSON.stringify(data),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    attempts: admin.firestore.FieldValue.increment(1)
                });
                logger.info('Updated pending message status to error', { documentId: event.id });
            } catch (error) {
                logger.error('Failed to update pending message status', { error, documentId: event.id });
            }
            return;
        }
        const db = admin.firestore();
        const userSnapshot = await db.collection('users')
            .where('email', '==', emailAddress)
            .limit(1)
            .get();
        const doc = userSnapshot.docs[0];
        const user = doc.data();
        const userUid = user.uid;
        const oldHistoryId = user.historyId;
        const messageIds = await getLatestMessages(userUid, oldHistoryId);
        logger.info('Found ' + messageIds.length + ' messages to process', { messages: messageIds });
        for (const messageId of messageIds) {
            const messageData = await getMessage({ userUid, messageId });
            await processAndStoreEmail(messageData, userUid, messageId);
        }
        if (!userSnapshot.empty) {
            const userRef = doc.ref;
            await userRef.update({ historyId });
            logger.info('Updated user with new historyId', { emailAddress, historyId });
        } else {
            logger.warn('User not found for email when trying to update historyId', { emailAddress });
        }
    } catch (error) {
        logger.error('Error handling new pending message', { error });
    }
}