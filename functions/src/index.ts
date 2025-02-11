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

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp();
}

// Constants
const TOPIC_NAME = 'gmail-topic';

export const addUserToDb = functionsv1.auth.user().onCreate(addUserToDbFunction);
export const startEmailWatching = functionsv2.https.onCall(startEmailWatchingFunction);
export const getEmails = functionsv2.https.onCall(getEmailsFunction);
export const updateHistoryId = onMessagePublished(TOPIC_NAME, onNewMessageFunction);
