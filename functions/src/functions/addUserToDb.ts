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
export const addUserToDbFunction = async (user: functionsv1.auth.UserRecord): Promise<AddUserToDbFunctionResponse> => {
  const userId = user.uid;
  const userInfo = user.providerData.map((provider) => provider.toJSON());
  try {
    const googleProvider = user.providerData.find(
      (provider) => provider.providerId === 'google.com'
    );
    if (!googleProvider) {
      logger.error('User is not authenticated with Google on addUserToDbFunction', { userId });
      return { success: false, userInfo };
    }
    await addUserToDb(user);
    logger.info('User added to Firestore on addUserToDbFunction', { userId });
    return { success: true, userInfo };
  } catch (error) {
    logger.error('Error adding user to db on addUserToDbFunction', { userId, error });
    return { success: false, userInfo, error: String(error) };
  }
}; 

type AddUserToDbFunctionResponse = {
  success: boolean;
  userInfo: Record<string, any>;
  error?: string;
}
