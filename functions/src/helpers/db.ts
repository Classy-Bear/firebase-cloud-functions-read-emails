import admin from "firebase-admin";
import { gmail_v1 } from "googleapis";
import { logger } from "firebase-functions/v2";
import { getFullMessage } from "./gmail";

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Fetches the refresh token for a user from the database
 * @param {string} uid - The Firebase user ID of the user to fetch the refresh token for
 * @returns {Promise<string>} A promise that resolves with the refresh token
 */
export const getRefreshToken = async (uid: string): Promise<string> => {
    const db = admin.firestore();
    const tokenSnapshot = await db.collection('gmail_tokens').doc(uid).get();
    if (!tokenSnapshot.exists) {
        throw new Error(`No token document found for user ${uid} on createGmailClient`);
    }
    const tokenData = tokenSnapshot.data();
    const refreshToken = tokenData?.refresh_token;
    if (!refreshToken) {
        throw new Error(`No refresh token found for user ${uid} on createGmailClient`);
    }
    return refreshToken;
}

/**
 * Stores the refresh token for a user in the database
 * @param {string} uid - The Firebase user ID of the user to store the refresh token for
 * @param {string} refreshToken - The refresh token to store
 */
export const storeRefreshToken = async (uid: string, refreshToken: string ) => {
    const db = admin.firestore();
    await db.collection('gmail_tokens').doc(uid).set({
        refresh_token: refreshToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Processes and stores an email message in Firestore
 * @param {any} message - Gmail message object
 * @param {string} userId - Firebase user ID
 */
export const processAndStoreEmail = async (message: gmail_v1.Schema$Message, userId: string, messageId: string) => {
  try {
    const { id } = message;
    if (!id) {
      throw new Error(`Message ID does not exist for message ${messageId} on user ${userId} on processAndStoreEmail`);
    }
    const db = admin.firestore();
    const emailRef = db.collection('emails').doc(userId).collection('messages').doc(id);
    const emailRefExists = await emailRef.get();
    if (emailRefExists.exists) {
      logger.info('Email already exists', { messageId: id, userId });
      return;
    }
    const emailData = await getFullMessage(message, userId, messageId);
    try {
      await emailRef.set({
        ...emailData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error('Error storing email in Firestore on processAndStoreEmail', { error, historyId: messageId, userId });
      throw error;
    }
    logger.info('Email stored successfully in Firestore on processAndStoreEmail', { historyId: messageId, userId });
  } catch (error) {
    logger.error('Error processing email on processAndStoreEmail', { error, historyId: messageId, userId });
    throw error;
  }
};
