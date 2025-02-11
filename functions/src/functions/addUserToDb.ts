import * as logger from "firebase-functions/logger";
import * as functionsv1 from "firebase-functions/v1";
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

export const addUserToDbFunction = async (user: functionsv1.auth.UserRecord) => {
  const userId = user.uid;
  try {
    const googleProvider = user.providerData.find(
      (provider) => provider.providerId === 'google.com'
    );
    if (!googleProvider) {
      logger.error('User is not authenticated with Google', { userId });
      throw new functionsv1.https.HttpsError(
        'failed-precondition',
        'User must be authenticated with Google'
      );
    }
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .set({
        email: user.email,
        uid: user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    logger.info("User added to Firestore", { userId });
  } catch (error) {
    logger.error('Error adding user to db', { userId, error });
    throw new functionsv1.https.HttpsError('internal', 'Failed to add user to db');
  }
}; 
