import * as functionsv2 from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

/**
 * Validates the user's request and returns the user's ID.
 * @param request - The request object containing the user's authentication information.
 * @returns The user ID.
 */
export const getCredentials = async (request: functionsv2.https.CallableRequest<any>) => {
  const auth = request.auth;
  const uid = auth?.uid;
  if (!uid) {
    logger.error('User is not authenticated on getCredentials', { request });
    throw new functionsv2.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to start email watching'
    );
  }
  return uid; 
}

