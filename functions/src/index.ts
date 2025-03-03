// Firebase functions
import * as functionsv1 from "firebase-functions/v1";
import * as functionsv2 from "firebase-functions/v2";
import { onMessagePublished } from "firebase-functions/pubsub";

// Admin
import * as admin from 'firebase-admin';

// Functions
import { addUserToDbFunction } from "./functions/addUserToDb";
import { startEmailWatchingFunction } from "./functions/startEmailWatching";
import { getEmailsFunction } from "./functions/getEmails";
import { onNewMessageFunction } from "./functions/onNewMessage";
import { storeRefreshTokenFunction } from "./functions/storeRefreshToken";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onNewPendingMessageFunction } from "./functions/onNewPendingMessage";

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp();
}

// Constants
const TOPIC_NAME = 'gmail-topic';

export const addUserToDb = functionsv1.auth.user().onCreate(addUserToDbFunction);
export const storeRefreshToken = functionsv2.https.onCall(storeRefreshTokenFunction);
export const startEmailWatching = functionsv2.https.onCall(startEmailWatchingFunction);
export const getEmails = functionsv2.https.onCall(getEmailsFunction);
export const updateHistoryId = onMessagePublished(TOPIC_NAME, onNewMessageFunction);
export const onNewPendingMessage = onDocumentCreated('pending-messages/{docId}', onNewPendingMessageFunction);
