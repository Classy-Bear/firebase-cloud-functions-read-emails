// Firebase functions
import * as logger from "firebase-functions/logger";
import * as functionsv2 from "firebase-functions/v2";

// Admin
import * as admin from 'firebase-admin';

// Google
import { createGmailClient, getMessage, getMessages } from '../helpers/gmail';
import { getUserFromDb, processAndStoreEmail } from '../helpers/db';
import { getCredentials } from "../utils/httpv2";

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Fetches and processes emails for a user
 * @param request - The request object containing the user's authentication information
 * @returns A promise that resolves to a boolean indicating success or failure
 */
export const getEmailsFunction = async (request: functionsv2.https.CallableRequest) => {
    try {
        const userUid = await getCredentials(request);
        await getUserFromDb(userUid); // This will throw an error if the user is not found
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
        throw new functionsv2.https.HttpsError('internal', 'Error listing messages on getEmailsFunction', error);
    }
};
