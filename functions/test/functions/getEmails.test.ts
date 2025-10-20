import { expect, sinon, cleanupTestData, generateTestId } from '../setup';
import * as functionsv2 from 'firebase-functions/v2';
import { getEmailsFunction } from '../../src/functions/getEmails';
import * as gmailHelper from '../../src/helpers/gmail';
import * as dbHelper from '../../src/helpers/db';
import * as httpv2Helper from '../../src/utils/httpv2';

describe('getEmailsFunction', () => {
  let testId: string;
  let createGmailClientStub: sinon.SinonStub;
  let getMessagesStub: sinon.SinonStub;
  let getUserFromDbStub: sinon.SinonStub;
  let getCredentialsStub: sinon.SinonStub;
  let getMessageStub: sinon.SinonStub;
  let processAndStoreEmailStub: sinon.SinonStub;
  let updateHistoryIdInDbStub: sinon.SinonStub;

  before(async () => {
    testId = generateTestId();
  });

  beforeEach(() => {
    sinon.restore();
    
    createGmailClientStub = sinon.stub(gmailHelper, 'createGmailClient');
    getMessagesStub = sinon.stub(gmailHelper, 'getMessages');
    getUserFromDbStub = sinon.stub(dbHelper, 'getUserFromDb');
    getCredentialsStub = sinon.stub(httpv2Helper, 'getCredentials');
    getMessageStub = sinon.stub(gmailHelper, 'getMessage');
    processAndStoreEmailStub = sinon.stub(dbHelper, 'processAndStoreEmail');
    updateHistoryIdInDbStub = sinon.stub(dbHelper, 'updateHistoryIdInDb');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('users', testId);
  });

  it('should fetch emails successfully', async () => {
    const testUid = `${testId}-user`;
    const mockRequest = {
      data: { maxResults: 10, q: 'is:unread' },
      auth: { uid: testUid }
    } as functionsv2.https.CallableRequest;

    const mockUser = { uid: testUid, email: 'test@example.com' };
    const mockOAuthClient = {};
    const mockMessages = [
      { 
        id: 'msg1', 
        internalDate: '1234567890000', 
        historyId: '12345',
        snippet: 'Test email snippet'
      }
    ];

    // Configure stubs to return valid data
    getCredentialsStub.resolves(testUid);
    getUserFromDbStub.resolves(mockUser);
    createGmailClientStub.resolves(mockOAuthClient);
    getMessagesStub.resolves({ messages: mockMessages, nextPageToken: null, resultSizeEstimate: 1 });

    // Mock the getMessage function to return valid message data
    getMessageStub.resolves({
      id: 'msg1',
      historyId: '12345',
      snippet: 'Test email snippet',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'test@example.com' },
          { name: 'To', value: 'user@example.com' }
        ],
        parts: [
          { mimeType: 'text/plain', body: { data: 'Test email content' } }
        ]
      }
    });

    // Mock the processAndStoreEmail function
    processAndStoreEmailStub.resolves();

    // Mock the updateHistoryIdInDb function
    updateHistoryIdInDbStub.resolves();

    const result = await getEmailsFunction(mockRequest);
    expect(result).to.deep.equal({ success: true });
  });

  it('should handle empty message results', async () => {
    const testUid = `${testId}-user-empty`;
    const mockRequest = {
      data: { maxResults: 10 },
      auth: { uid: testUid }
    } as functionsv2.https.CallableRequest;

    const mockUser = { uid: testUid, email: 'test@example.com' };
    const mockOAuthClient = {};

    getCredentialsStub.resolves(testUid);
    getUserFromDbStub.resolves(mockUser);
    createGmailClientStub.resolves(mockOAuthClient);
    getMessagesStub.resolves({ messages: [], nextPageToken: null, resultSizeEstimate: 0 });

    const result = await getEmailsFunction(mockRequest);
    expect(result).to.deep.equal({ success: true });
  });

  it('should throw HttpsError when user is not authenticated', async () => {
    const mockRequest = {
      data: { maxResults: 10 },
      auth: {}
    } as functionsv2.https.CallableRequest;

    try {
      await getEmailsFunction(mockRequest);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.code).to.equal('internal');
    }
  });

  it('should throw HttpsError when user is not found in database', async () => {
    const testUid = `${testId}-user-not-found`;
    const mockRequest = {
      data: { maxResults: 10 },
      auth: { uid: testUid }
    } as functionsv2.https.CallableRequest;

    getCredentialsStub.resolves(testUid);
    getUserFromDbStub.rejects(new Error('User not found'));

    try {
      await getEmailsFunction(mockRequest);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.code).to.equal('internal');
    }
  });

  it('should throw HttpsError when Gmail API fails', async () => {
    const testUid = `${testId}-user-gmail-fail`;
    const mockRequest = {
      data: { maxResults: 10 },
      auth: { uid: testUid }
    } as functionsv2.https.CallableRequest;

    const mockUser = { uid: testUid, email: 'test@example.com' };

    getCredentialsStub.resolves(testUid);
    getUserFromDbStub.resolves(mockUser);
    createGmailClientStub.rejects(new Error('Gmail API error'));

    try {
      await getEmailsFunction(mockRequest);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.code).to.equal('internal');
    }
  });
});
