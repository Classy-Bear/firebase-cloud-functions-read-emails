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
 * Parameters for fetching messages from the user's Gmail account
 * @property {string} userUid - The Firebase user ID
 * @property {OAuth2Client} client - The Gmail client to use
 * @property {number} maxResults - The maximum number of messages to fetch
 * @property {string} q - The query to use for fetching messages
 */
type GetMessagesParams = {
  userUid: string;
  client?: OAuth2Client;
  maxResults?: number;
  q?: string;
}

/**
 * Fetches messages from the user's Gmail account
 * @param {GetMessagesParams} params - The parameters for the messages
 * @returns {Promise<GetMessagesResponse>} A promise that resolves with an array of messages
 */
export const getMessages = async (params: GetMessagesParams): Promise<GetMessagesResponse> => {
  const { userUid, client, maxResults, q } = params;
  try {
    const auth = client || await createGmailClient(userUid);
    const gmail = google.gmail({ version: 'v1', auth });
    const messagesList = await gmail.users.messages.list({ userId: 'me', maxResults, q });
    logger.info('Message list fetched successfully', { userUid });
    const messagesData = messagesList.data;
    const messages = messagesData.messages;
    if (!messages) {
      logger.info('No messages found for this user.', { userUid });
      return { messages: [], nextPageToken: null, resultSizeEstimate: 0 };
    }
    const resultSizeEstimate = messagesData.resultSizeEstimate || 0;
    const nextPageToken = messagesData.nextPageToken || null;
    return { messages, nextPageToken, resultSizeEstimate };
  } catch (error) {
    logger.error('Error fetching messages', { error, userUid });
    throw error;
  }
}

/**
 * Parameters for fetching a message from the user's Gmail account
 * @property {string} userUid - The Firebase user ID
 * @property {string} messageId - The ID of the message to fetch
 * @property {OAuth2Client} client - The Gmail client to use
 * @property {string} format - The format of the message to fetch
 */
type GetMessageParams = {
  userUid: string;
  messageId: string;
  client?: OAuth2Client;
  format?: 'raw' | 'full';
}

/**
 * Fetches a message from the user's Gmail account
 * @param {GetMessageParams} params - The parameters for the message
 * @returns {Promise<gmail_v1.Schema$Message>} A promise that resolves with the message
 */
export const getMessage = async (params: GetMessageParams): Promise<gmail_v1.Schema$Message> => {
  const { userUid, messageId, client, format = 'full' } = params;
  const auth = client || await createGmailClient(userUid);
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: format,
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
 * Represents an attachment
 * @property {string} id - The ID of the attachment
 * @property {string} filename - The filename of the attachment
 * @property {string} mimeType - The MIME type of the attachment
 * @property {number | undefined} size - The size of the attachment
 * @property {string} data - The base64 encoded data of the attachment
 */
type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size?: number | null;
  data: string;
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
 * @property {boolean} hasAttachments - Whether the message has attachments
 * @property {Array<Attachment> | null} attachments - The attachments of the message
 */
type EmailData = {
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
  hasAttachments: boolean;
  attachments: Array<Attachment> | null;
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
        hasAttachments: parsedEmail.attachments.length > 0,
        attachments: null,
      };
    } catch (error) {
      logger.error(`Error parsing raw email for message ${messageId} on user ${userId} in processAndStoreEmail`, { error });
      throw error;
    }
  } else if (message.payload) {
    logger.info(`Payload email for message ${messageId} on user ${userId} in processAndStoreEmail`, { payload: message.payload });
    const headers = message.payload.headers;
    const dateValue = headers?.find((header: any) => header.name === 'Date')?.value;
    const date = dateValue ? new Date(dateValue) : null;
    const subject = headers?.find((header: any) => header.name === 'Subject')?.value;
    const from = headers?.find((header: any) => header.name === 'From')?.value;
    const to = headers?.find((header: any) => header.name === 'To')?.value;
    const parts = message.payload.parts;
    const body = parts?.find((part: any) => part.mimeType === 'text/html')?.body?.data;
    const text = parts?.find((part: any) => part.mimeType === 'text/plain')?.body?.data;
    const labels = message.labelIds;
    const snippet = message.snippet;
    const attachments = parts?.filter((part: any) => part.mimeType === 'application/octet-stream').map((part: any) => ({
      id: part.body?.attachmentId || null,
      filename: part.filename || null,
      mimeType: part.mimeType || null,
      size: part.body?.size || null,
      data: part.body?.data || null,
    })) || null;
    const hasAttachments = (attachments?.length ?? 0) > 0 || false;
    return {
      messageId: id,
      historyId: message.historyId || null,
      subject: subject || null,
      from: from || null,
      to: to || null,
      date: date || null,
      body: body || null,
      text: text || null,
      labels: labels || null,
      snippet: snippet || null,
      hasAttachments: hasAttachments || false,
      attachments: attachments || null,
    };
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

/**
 * Parameters for fetching an attachment from a Gmail message
 * @property {string} userUid - The Firebase user ID
 * @property {string} messageId - The Gmail message ID
 * @property {OAuth2Client} client - The Gmail client
 */
type GetAttachmentParams = {
  userUid: string;
  messageId: string;
  client?: OAuth2Client
}

/**
 * Fetches attachments from a Gmail message
 * @param {GetAttachmentParams} params - The parameters for the attachments
 * @returns {Promise<{ id: string; buffer: Buffer; size: number }[]>} The attachment data
 */
export const getAttachments = async (params: GetAttachmentParams): Promise<Attachment[]> => {
  const { userUid, messageId, client } = params;
  const auth = client || await createGmailClient(userUid);
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const fullMessage = await getMessage({ userUid, messageId, client, format: 'full' });
    logger.info('Message fetched successfully on getAttachments', { userUid, messageId, fullMessage });
    const parts = fullMessage.payload?.parts;
    if (!parts) {
      throw new Error('No parts found');
    }
    const attachments = [];
    for (const part of parts) {
      if (part.mimeType == "text/html") {
        logger.info('HTML part found, skipping attachment on getAttachments', { userUid, messageId, part });
      } else if (part.mimeType == "application/octet-stream") {
        const id = part.body?.attachmentId;
        const filename = part.filename;
        const mimeType = part.mimeType;
        const size = part.body?.size;
        if (!id) {
          logger.warn('Attachment ID not found', { userUid, messageId, part });
          continue;
        }
        if (!filename) {
          logger.warn('Attachment filename not found', { userUid, messageId, part });
          continue;
        }
        if (!mimeType) {
          logger.warn('Attachment MIME type not found', { userUid, messageId, part });
          continue;
        }
        attachments.push({ id, filename, mimeType, size });
      } else {
        logger.warn('Unknown part found, skipping attachment on getAttachments', { userUid, messageId, part });
      }
    }
    const attachmentsData: Attachment[] = [];
    for (const attachment of attachments) {
      const { id } = attachment;
      const mailAttachment = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: id
      });
      if (!mailAttachment) {
        logger.warn('Attachment not found', { userUid, messageId, attachment });
        continue;
      }
      const attachmentData = mailAttachment.data.data;
      if (!attachmentData) {
        logger.warn('No attachment data found', { userUid, messageId, attachment });
        continue;
      }
      attachmentsData.push({ ...attachment, data: attachmentData });
    }
    return attachmentsData;
  } catch (error) {
    logger.error('Error fetching attachment', { error, userUid, messageId });
    throw error;
  }
};
