import * as logger from "firebase-functions/logger";
import * as functionsv1 from "firebase-functions/v1";
import * as admin from 'firebase-admin';
import { addUserToDb } from "../helpers/db";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Adds a user to the database
 * @param {functionsv1.auth.UserRecord} user - The user to add to the database
 * @returns {Promise<void>} A promise that resolves when the user is added to the database
 */
export const addUserToDbFunction = async (user: functionsv1.auth.UserRecord): Promise<void> => {
  const userId = user.uid;
  try {
    const googleProvider = user.providerData.find(
      (provider) => provider.providerId === 'google.com'
    );
    if (!googleProvider) {
      logger.error('User is not authenticated with Google on addUserToDbFunction', { userId });
      return;
    }
    await addUserToDb(user);
    logger.info('User added to Firestore on addUserToDbFunction', { userId });
  } catch (error) {
    logger.error('Error adding user to db on addUserToDbFunction', { userId, error });
  }
}; 
