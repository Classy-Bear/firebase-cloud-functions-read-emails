// Admin
import * as admin from 'firebase-admin';

// Firebase functions
import * as functionsv2 from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

import { createGmailClient, watchGmail } from '../helpers/gmail';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Firebase function that starts email watching for a user.
 *
 * This function checks for an existing watch, validates that the user is registered,
 * sets up the Gmail watch on the user's behalf, and then stores the token.
 */
export const startEmailWatchingFunction = async (request: functionsv2.https.CallableRequest) => {
  try {
    const data = request.data;
    const uid = data.uid;
    logger.info(`Creating Gmail client for user ${uid} on startEmailWatchingFunction`);
    const oauth2Client = await createGmailClient(uid);
    logger.info(`Gmail client created successfully for user ${uid} on startEmailWatchingFunction`);
    await watchGmail(uid, oauth2Client);
    logger.info(`Email watching started successfully for user ${uid} on startEmailWatchingFunction`);
    return { success: true };
  } catch (error) {
    logger.error(`Error starting email watch on startEmailWatchingFunction`, { error, request });
    throw new functionsv2.https.HttpsError('internal', 'Failed to start email watching');
  }
}
