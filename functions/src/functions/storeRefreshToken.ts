// Admin
import * as admin from 'firebase-admin';

// Firebase functions
import * as functionsv2 from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

import { exchangeAuthCodeForRefreshToken } from '../helpers/gmail';
import { storeRefreshToken } from '../helpers/db';
import { getCredentials } from '../utils/httpv2';

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
export const storeRefreshTokenFunction = async (request: functionsv2.https.CallableRequest) => {
  try {
    const data = request.data;
    logger.info(`Storing refresh token for user ${data.uid} on storeRefreshTokenFunction`);
    const uid = await getCredentials(request);
    logger.info(`Storing refresh token for user ${uid} on storeRefreshTokenFunction`);
    const { authCode } = data;
    const { refresh_token } = await exchangeAuthCodeForRefreshToken(authCode, uid);
    logger.info(`Refresh token obtained successfully for user ${uid} on storeRefreshTokenFunction`);
    await storeRefreshToken(uid, refresh_token);
    logger.info(`Refresh token stored successfully for user ${uid} on storeRefreshTokenFunction`);
  } catch (error) {
    logger.error(`Error storing refresh token on storeRefreshTokenFunction`, { error, request });
    throw new functionsv2.https.HttpsError('internal', 'Failed to store refresh token');
  }
}
