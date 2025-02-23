import { logger } from "firebase-functions/v1";
import { gmail_v1, google } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import { getRefreshToken, storeRefreshToken } from "./db";
import { simpleParser } from "mailparser";
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * Creates an authorized Gmail API client using the refresh token stored for a given user.
 * @param {string} uid - Firebase user ID used to lookup the refresh token.
 * @returns {Promise<OAuth2Client>} A promise that resolves with the authorized OAuth2 client.
 */
export const createGmailClient = async (uid: string): Promise<OAuth2Client> => {
  const refreshToken = await getRefreshToken(uid);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  let credentials: Credentials;
  try {
    logger.info(`Refreshing access token for user ${uid} on createGmailClient`);
    const response = await oauth2Client.refreshAccessToken();
    credentials = response.credentials;
    logger.info(`Access token refreshed for user ${uid} on createGmailClient`);
  } catch (error) {
    logger.error(`Failed to refresh access token for user ${uid} on createGmailClient`, { error });
    throw error;
  }
  const { access_token, refresh_token } = credentials;
  if (!access_token || !refresh_token) {
    throw new Error(`Failed to obtain access or refresh token for user ${uid} on createGmailClient`);
  }
  logger.info(`Refreshed access token and refresh token are valid for user ${uid} on createGmailClient`);
  try {
    await storeRefreshToken(uid, refresh_token);
    logger.info(`Updated token document for user ${uid} on createGmailClient`);
  } catch (error) {
    logger.error(`Failed to update token document for user ${uid} on createGmailClient`, { error });
    throw error;
  }
  oauth2Client.setCredentials({
    access_token,
    scope: GMAIL_SCOPE,
  });
  logger.info(`Created Gmail client for user ${uid} on createGmailClient`);
  return oauth2Client;
};

/**
 * Represents the response from the exchangeAuthCodeForRefreshToken function
 * @property {string} access_token - The access token
 * @property {string} refresh_token - The refresh token
 */
type RefreshTokenResponse = {
  access_token: string;
  refresh_token: string;
}

/**
 * Exchanges an authorization code for access and refresh tokens
 * @param {string} authCode - The authorization code to exchange
 * @param {string} uid - Firebase user ID
 * @returns {Promise<RefreshTokenResponse>} A promise that resolves with the access and refresh tokens
 */
export const exchangeAuthCodeForRefreshToken = async (authCode: string, uid: string): Promise<RefreshTokenResponse> => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  try {
    const { tokens } = await oauth2Client.getToken(authCode);
    const { access_token, refresh_token } = tokens;
    if (!access_token || !refresh_token) {
      throw new Error('Failed to obtain access or refresh token');
    }
    return { access_token, refresh_token };
  } catch (error) {
    logger.error('Error exchanging auth code for tokens', { error, uid });
    throw error;
  }
};

/**
 * Represents the response from the getMessages function
 * @property {gmail_v1.Schema$Message[]} messages - The messages
 * @property {string | null} nextPageToken - The next page token
 * @property {number} resultSizeEstimate - The result size estimate
 */
type GetMessagesResponse = {
  messages: gmail_v1.Schema$Message[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

/**
 * Fetches messages from the user's Gmail account
 * @param {string} userUid - The Firebase user ID of the user to fetch messages for
 * @param {OAuth2Client} client - The Gmail client to use
 * @returns {Promise<GetMessagesResponse>} A promise that resolves with an array of messages
 */
export const getMessages = async (userUid: string, client?: OAuth2Client): Promise<GetMessagesResponse> => {
  try {
    const auth = client || await createGmailClient(userUid);
    const gmail = google.gmail({ version: 'v1', auth });
    const messagesList = await gmail.users.messages.list({ userId: 'me' });
    logger.info('Message list fetched successfully', { userUid });
    const messagesData = messagesList.data;
    if (!messagesData.messages) {
      logger.info('No messages found for this user.', { userUid });
      return { messages: [], nextPageToken: null, resultSizeEstimate: 0 };
    }
    const messages = messagesData.messages;
    const resultSizeEstimate = messagesData.resultSizeEstimate || 0;
    const nextPageToken = messagesData.nextPageToken || null;
    return { messages, nextPageToken, resultSizeEstimate };
  } catch (error) {
    logger.error('Error fetching messages', { error, userUid });
    throw error;
  }
}

/**
 * Fetches a message from the user's Gmail account
 * @param {string} userUid - The Firebase user ID of the user to fetch the message for
 * @param {string} messageId - The ID of the message to fetch
 * @param {OAuth2Client} client - The Gmail client to use
 * @returns {Promise<gmail_v1.Schema$Message>} A promise that resolves with the message
 */
export const getMessage = async (userUid: string, messageId: string, client?: OAuth2Client): Promise<gmail_v1.Schema$Message> => {
  const auth = client || await createGmailClient(userUid);
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'raw',
    });
    logger.info('Message fetched successfully', { userUid, messageId });
    const messageDetails = messageResponse.data;
    return messageDetails;
  } catch (error) {
    logger.error('Error fetching message', { error, userUid, messageId });
    throw error;
  }
}

/**
 * Represents the data for an email message
 * @property {string} messageId - The ID of the message
 * @property {string | null} historyId - The history ID of the message
 * @property {string | null} subject - The subject of the message
 * @property {string | null} from - The sender of the message
 * @property {string[] | string | null} to - The recipient of the message
 * @property {Date | null} date - The date of the message
 * @property {string | null} body - The body of the message
 * @property {string | null} text - The text of the message
 * @property {string[] | null} labels - The labels of the message
 * @property {string | null} snippet - The snippet of the message
 */
interface EmailData {
  messageId: string;
  historyId: string | null;
  subject: string | null;
  from: string | null;
  to: string[] | string | null;
  date: Date | null;
  body: string | null;
  text: string | null;
  labels: string[] | null;
  snippet: string | null;
}

/**
 * Fetches the headers of a message
 * @param {gmail_v1.Schema$Message} message - The message to fetch the headers for
 * @returns {Promise<gmail_v1.Schema$MessageHeader[]>} A promise that resolves with the headers
 */
export const getFullMessage = async (message: gmail_v1.Schema$Message, userId: string, messageId: string): Promise<EmailData> => {
  const { id, historyId } = message;
  if (!id) {
    throw new Error(`Message ID does not exist for message ${messageId} on user ${userId} on processAndStoreEmail`);
  }
  if (!historyId) {
    throw new Error(`History ID does not exist for message ${messageId} on user ${userId} on processAndStoreEmail`);
  }
  if (message.raw) {
    logger.info(`Raw email for message ${messageId} on user ${userId} in processAndStoreEmail`, { raw: message.raw });
    try {
      const rawMessage = Buffer.from(message.raw, 'base64').toString('utf-8');
      logger.info(`Raw message for message ${messageId} on user ${userId} in processAndStoreEmail`, { rawMessage });
      const parsedEmail = await simpleParser(rawMessage);
      logger.info(`Parsed email for message ${messageId} on user ${userId} in processAndStoreEmail`, { parsedEmail });
      return {
        messageId: id,
        historyId: message.historyId || null,
        subject: parsedEmail.subject || null,
        from: parsedEmail.from?.text || null,
        to: parsedEmail.to instanceof Array ? parsedEmail.to.map((t) => t.text) : parsedEmail.to?.text || null,
        date: parsedEmail.date ? new Date(parsedEmail.date) : null,
        body: parsedEmail.html || null,
        text: parsedEmail.text || null,
        labels: message.labelIds || null,
        snippet: message.snippet || null,
      };
    } catch (error) {
      logger.error(`Error parsing raw email for message ${messageId} on user ${userId} in processAndStoreEmail`, { error });
      throw error;
    }
  } else {
    throw new Error(`No raw email content found for message ${messageId} on user ${userId} in processAndStoreEmail`);
  }
}

/**
 * Fetches the latest messages from the user's Gmail account
 * @param {string} userUid - The Firebase user ID of the user to fetch messages for
 * @param {string} historyId - The history ID of the message to fetch
 * @returns {Promise<string[]>} A promise that resolves with an array of message IDs
 */
export const getLatestMessages = async (userUid: string, historyId: string, client?: OAuth2Client): Promise<string[]> => {
  const auth = client || await createGmailClient(userUid);
  const gmail = google.gmail({ version: 'v1', auth });
  const historyList = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded'], // Focus on newly added messages.
  });
  if (!historyList.data.history) {
    logger.info('No new history events for this queue item.', { historyId, userUid });
    return [];
  }
  const messages = [];
  for (const historyRecord of historyList.data.history) {
    if (historyRecord.messagesAdded) {
      for (const addedMessage of historyRecord.messagesAdded) {
        const messageId = addedMessage.message?.id;
        if (!messageId) {
          logger.warn('Message ID missing in messagesAdded.', { historyRecord });
          continue;
        }
        messages.push(messageId);
        logger.info('Fetched message from queue:', { messageId, userUid, historyId });
      }
    }
  }
  return messages;
}

// Constants
const PROJECT_NAME = process.env.MY_FIREBASE_PROJECT_NAME;
const TOPIC_NAME = 'gmail-topic';
const topicName = `projects/${PROJECT_NAME}/topics/${TOPIC_NAME}`;

/**
 * Sets up Gmail watch for a user
 * @param {string} uid - The Firebase user ID of the user to set up Gmail watch for
 * @param {OAuth2Client} client - The Gmail client to use
 */
export const watchGmail = async (uid: string, client: OAuth2Client) => {
  const gmail = google.gmail({ version: 'v1', auth: client });
  logger.info(`Setting up Gmail watch for user ${uid} on watchGmail`);
  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName,
    },
  });
};
