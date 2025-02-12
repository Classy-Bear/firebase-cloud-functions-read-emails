// Firebase functions
import * as logger from "firebase-functions/logger";
import * as functionsv2 from "firebase-functions/v2";

// Admin
import * as admin from 'firebase-admin';

// Google
import { createGmailClient, getMessage, getMessages } from '../helpers/gmail';
import { processAndStoreEmail } from '../helpers/db';

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Fetches and logs emails from the emailProcessingQueue based on a given historyId.
 * @param emailAddress - The email address of the user to fetch emails for.
 * @returns - A promise that resolves to void.
 */
export const getEmailsFunction = async (request: functionsv2.https.CallableRequest) => {
    const db = admin.firestore();
    try {
        const userUid = request.auth?.uid;
        if (!userUid) {
            throw new functionsv2.https.HttpsError('unauthenticated', 'User not found', request);
        }
        const userDoc = await db.collection('users').doc(userUid).get();
        if (!userDoc.exists) {
            throw new functionsv2.https.HttpsError('not-found', `User not found for email: ${userUid}`, request);
        }
        const userData = userDoc.data();
        if (!userData) {
            throw new functionsv2.https.HttpsError('not-found', `User data not found for email: ${userUid}`, request);
        }
        const client = await createGmailClient(userUid);
        const { messages } = await getMessages(userUid, client);
        logger.info(`Fetched ${messages.length} messages for user ${userUid} on getEmailsFunction`);
        for (const message of messages) {
            const messageId = message.id;
            if (!messageId) {
                logger.warn('Message ID missing from message on getEmailsFunction', { message });
                continue;
            }
            const messageDetails = await getMessage(userUid, messageId, client);
            logger.info('Fetched message details on getEmailsFunction:', { messageDetails });
            await processAndStoreEmail(messageDetails, userUid, messageId);
            logger.info('Processed and stored email on getEmailsFunction:', { messageId });
        }
        logger.info('Successfully processed and stored all emails on getEmailsFunction');
        return { success: true };
    } catch (error) {
        logger.error('Error listing messages on getEmailsFunction:', { error, request });
        throw new functionsv2.https.HttpsError('internal', 'Error listing messages on getEmailsFunction', request);
    }
};
