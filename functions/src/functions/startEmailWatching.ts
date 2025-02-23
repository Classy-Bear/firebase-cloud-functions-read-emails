// Admin
import * as admin from 'firebase-admin';

// Firebase functions
import * as functionsv2 from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

// Google
import { google } from 'googleapis';
// import { OAuth2Client } from 'google-auth-library';

// Dotenv
import * as dotenv from 'dotenv';
import { createGmailClient, exchangeAuthCodeForRefreshToken } from '../helpers/gmail';
import { storeRefreshToken } from '../helpers/db';
import { getCredentials } from '../utils/httpv2';
dotenv.config();

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp();
}

// Constants
const PROJECT_NAME = process.env.MY_FIREBASE_PROJECT_NAME;
const TOPIC_NAME = 'gmail-topic';
const topicName = `projects/${PROJECT_NAME}/topics/${TOPIC_NAME}`;

/**
 * Sets up Gmail push notifications for a user
 * @param uid - User ID
 */
const setupGmailWatch = async (uid: string) => {
  try {
    logger.info(`Setting up Gmail watch for user ${uid} on setupGmailWatch`);
    const db = admin.firestore();
    const tokenSnapshot = await db.collection('gmail_tokens').doc(uid).get();
    if (!tokenSnapshot.exists) {
      throw new Error(`No token document found for user ${uid} on setupGmailWatch`);
    }
    const tokenData = tokenSnapshot.data();
    const refreshToken = tokenData?.refresh_token;
    if (!refreshToken) {
      throw new Error(`No refresh token found for user ${uid} on setupGmailWatch`);
    }
    logger.info(`Creating Gmail client for user ${uid} on setupGmailWatch`);
    const oauth2Client = await createGmailClient(uid);
    logger.info(`Gmail client created successfully for user ${uid} on setupGmailWatch`);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    logger.info(`Setting up Gmail watch for user ${uid} on setupGmailWatch`);
    await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName,
      },
    });
    logger.info(`Gmail watch set up successfully for user ${uid} on setupGmailWatch`);
  } catch (error) {
    logger.error(`Error setting up Gmail watch for user ${uid} on setupGmailWatch`, { error });
    throw error;
  }
};

/**
 * Firebase function that starts email watching for a user.
 *
 * This function checks for an existing watch, validates that the user is registered,
 * sets up the Gmail watch on the user's behalf, and then stores the token.
 */
export const startEmailWatchingFunction = async (request: functionsv2.https.CallableRequest) => {
  try {
    const data = request.data;
    logger.info(`Start email watching for user ${data.uid} on startEmailWatchingFunction`);
    const uid = await getCredentials(request);
    const { authCode } = data;
    logger.info(`Storing refresh token for user ${uid} on startEmailWatchingFunction`);
    const { refresh_token } = await exchangeAuthCodeForRefreshToken(authCode, uid);
    logger.info(`Refresh token obtained successfully for user ${uid} on startEmailWatchingFunction`);
    await storeRefreshToken(uid, refresh_token);
    logger.info(`Refresh token stored successfully for user ${uid} on startEmailWatchingFunction`);
    await setupGmailWatch(uid);
    logger.info(`Email watching started successfully for user ${uid} on startEmailWatchingFunction`);
    return { success: true };
  } catch (error) {
    logger.error(`Error starting email watch on startEmailWatchingFunction`, { error, request });
    throw new functionsv2.https.HttpsError('internal', 'Failed to start email watching');
  }
}
