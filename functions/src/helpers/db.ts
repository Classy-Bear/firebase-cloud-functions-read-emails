import admin from "firebase-admin";
import { gmail_v1 } from "googleapis";
import { logger } from "firebase-functions/v2";
import { getFullMessage, getAttachments } from "./gmail";
import { uploadAttachment } from "./storage";
import * as functionsv1 from "firebase-functions/v1";

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
export const storeRefreshToken = async (uid: string, refreshToken: string) => {
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
    const attachmentsWithUrls = [];
    try {
      if (emailData.hasAttachments && emailData.attachments) {
        const attachments = emailData.attachments;
        for (const attachment of attachments) {
          const downloadUrl = await uploadAttachment({
            userId,
            messageId: id,
            attachmentId: attachment.id,
            buffer: Buffer.from(attachment.data, 'base64'),
            filename: attachment.filename,
            contentType: attachment.mimeType
          });
          attachmentsWithUrls.push({
            ...attachment,
            downloadUrl
          });
        }
      } else {
        logger.info('Email has no attachments', { messageId: id, userId });
      }
    } catch (error) {
      logger.error('Error processing attachment', { error, messageId: id, userId });
      throw error;
    }
    try {
      await emailRef.set({
        ...emailData,
        attachments: attachmentsWithUrls.length > 0 ? attachmentsWithUrls : emailData.attachments,
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

/**
 * Adds a user to the database
 * @param {functionsv1.auth.UserRecord} user - The user to add
 */
export const addUserToDb = async (user: functionsv1.auth.UserRecord) => {
  const db = admin.firestore();
  await db.collection('users').doc(user.uid).set({
    email: user.email,
    uid: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Fetches a user from the database
 * @param {string} uid - The Firebase user ID of the user to fetch
 * @returns {Promise<admin.firestore.DocumentData>} A promise that resolves with the user
 */
export const getUserFromDb = async (uid: string): Promise<admin.firestore.DocumentData> => {
  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error(`User not found for email: ${uid}`);
  }
  const userData = userDoc.data();
  if (!userData) {
    throw new Error(`User data not found for email: ${uid}`);
  }
  return userData;
}

/**
 * Updates the historyId for a user in the database
 * @param {string} userId - The user ID
 * @param {string} historyId - The new history ID to update
 * @returns {Promise<void>} A promise that resolves when the historyId is updated
 */
export const updateHistoryIdInDb = async (userId: string, historyId: string): Promise<void> => {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error(`User not found for userId: ${userId}`);
  }
  await userRef.update({ historyId });
}
