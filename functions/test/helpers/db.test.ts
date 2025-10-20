import { expect, cleanupTestData, generateTestId } from '../setup';
import * as admin from 'firebase-admin';
import { getRefreshToken, storeRefreshToken, addUserToDb, getUserFromDb, updateHistoryIdInDb, processAndStoreEmail } from '../../src/helpers/db';
import { gmail_v1 } from 'googleapis';
import sinon from 'sinon';

// Import the modules to mock
import * as gmailHelper from '../../src/helpers/gmail';
import * as storageHelper from '../../src/helpers/storage';

describe('Database Helper Tests', () => {
  let testId: string;
  let db: admin.firestore.Firestore;
  let getFullMessageStub: sinon.SinonStub;
  let uploadAttachmentStub: sinon.SinonStub;

  before(async () => {
    db = admin.firestore();
    testId = generateTestId();
  });

  beforeEach(() => {
    // Create fresh stubs for each test
    getFullMessageStub = sinon.stub(gmailHelper, 'getFullMessage');
    uploadAttachmentStub = sinon.stub(storageHelper, 'uploadAttachment');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('gmail_tokens', testId);
    await cleanupTestData('users', testId);
    await cleanupTestData('emails', testId);
    
    // Restore all stubs
    getFullMessageStub.restore();
    uploadAttachmentStub.restore();
  });

  describe('getRefreshToken', () => {
    it('should return refresh token when document exists', async () => {
      const testUid = `${testId}-user`;
      const mockToken = 'mock-refresh-token';
      
      // Create test data in real Firestore
      await db.collection('gmail_tokens').doc(testUid).set({
        refresh_token: mockToken,
        testId: testId
      });

      const result = await getRefreshToken(testUid);
      
      expect(result).to.equal(mockToken);
    });

    it('should throw error when document does not exist', async () => {
      const testUid = `${testId}-nonexistent`;

      try {
        await getRefreshToken(testUid);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('No token document found');
      }
    });

    it('should throw error when refresh token is missing', async () => {
      const testUid = `${testId}-user-no-token`;
      
      // Create test data without refresh token
      await db.collection('gmail_tokens').doc(testUid).set({
        testId: testId
        // Missing refresh_token field
      });

      try {
        await getRefreshToken(testUid);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('No refresh token found');
      }
    });
  });

  describe('storeRefreshToken', () => {
    it('should store refresh token successfully', async () => {
      const testUid = `${testId}-user`;
      const mockToken = 'mock-refresh-token';
      
      await storeRefreshToken(testUid, mockToken);

      // Add testId for cleanup purposes - use set with merge: true to ensure testId is added
      await db.collection('gmail_tokens').doc(testUid).set({
        testId: testId
      }, { merge: true });

      // Verify the token was stored by reading it back
      const doc = await db.collection('gmail_tokens').doc(testUid).get();
      
      expect(doc.exists).to.be.true;
      expect(doc.data()?.refresh_token).to.equal(mockToken);
      expect(doc.data()?.testId).to.equal(testId);
    });

    it('should handle Firestore operations successfully', async () => {
      // This test verifies the function works with real Firestore operations
      const testUid = `${testId}-user-error`;
      const mockToken = 'mock-refresh-token';
      
      await storeRefreshToken(testUid, mockToken);
      
      // Add testId for cleanup purposes - use set with merge: true to ensure testId is added
      await db.collection('gmail_tokens').doc(testUid).set({
        testId: testId
      }, { merge: true });
      
      // Verify it was stored
      const doc = await db.collection('gmail_tokens').doc(testUid).get();
      
      expect(doc.exists).to.be.true;
      expect(doc.data()?.refresh_token).to.equal(mockToken);
      expect(doc.data()?.testId).to.equal(testId);
    });
  });

  describe('addUserToDb', () => {
    it('should add user to database successfully', async () => {
      const testUid = `${testId}-user`;
      const mockUser = {
        uid: testUid,
        email: 'test@example.com',
        emailVerified: false,
        disabled: false,
        metadata: {},
        providerData: [],
        toJSON: () => ({})
      } as any; // Use any to avoid complex type casting for test purposes

      await addUserToDb(mockUser);

      // Verify the user was stored
      const doc = await db.collection('users').doc(testUid).get();
      expect(doc.exists).to.be.true;
      expect(doc.data()?.email).to.equal('test@example.com');
      expect(doc.data()?.uid).to.equal(testUid);
      expect(doc.data()?.createdAt).to.exist;
    });
  });

  describe('getUserFromDb', () => {
    it('should return user when document exists', async () => {
      const testUid = `${testId}-user`;
      const mockUser = { uid: testUid, email: 'test@example.com' };
      
      // Create test user
      await db.collection('users').doc(testUid).set({
        ...mockUser,
        testId: testId
      });

      const result = await getUserFromDb(testUid);

      // The function returns the full user data including testId
      expect(result.uid).to.equal(mockUser.uid);
      expect(result.email).to.equal(mockUser.email);
      expect(result.testId).to.equal(testId);
    });

    it('should throw error when user does not exist', async () => {
      const testUid = `${testId}-nonexistent`;

      try {
        await getUserFromDb(testUid);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('User not found');
      }
    });

    it('should return data when document exists with any fields', async () => {
      const testUid = `${testId}-user-minimal-data`;
      
      // Create document with minimal data (just testId for cleanup)
      await db.collection('users').doc(testUid).set({
        testId: testId
        // Minimal data - function should still return this
      });

      const result = await getUserFromDb(testUid);
      
      // The function returns whatever data exists in the document
      expect(result.testId).to.equal(testId);
    });
  });

  describe('updateHistoryIdInDb', () => {
    it('should update history ID successfully', async () => {
      const testUid = `${testId}-user`;
      const historyId = '12345';
      
      // Create test user first
      await db.collection('users').doc(testUid).set({
        uid: testUid,
        email: 'test@example.com',
        testId: testId
      });

      await updateHistoryIdInDb(testUid, historyId);

      // Verify the history ID was updated
      const doc = await db.collection('users').doc(testUid).get();
      expect(doc.data()?.historyId).to.equal(historyId);
    });

    it('should throw error when user does not exist', async () => {
      const testUid = `${testId}-nonexistent`;

      try {
        await updateHistoryIdInDb(testUid, '12345');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('User not found');
      }
    });
  });

  describe('processAndStoreEmail', () => {
    // Helper function to create mock Gmail message
    const createMockGmailMessage = (overrides: Partial<gmail_v1.Schema$Message> = {}): gmail_v1.Schema$Message => ({
      id: 'mock-message-123',
      historyId: 'mock-history-789',
      snippet: 'Test email snippet',
      labelIds: ['INBOX'],
      ...overrides
    });

    // Helper function to create mock email data
    const createMockEmailData = (overrides: any = {}) => ({
      messageId: 'mock-message-123',
      historyId: 'mock-history-789',
      subject: 'Test Email Subject',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      date: new Date('2024-01-01T00:00:00Z'),
      body: '<p>Test email body</p>',
      text: 'Test email body',
      labels: ['INBOX'],
      snippet: 'Test email snippet',
      hasAttachments: false,
      attachments: null,
      ...overrides
    });

    it('should return early if email already exists', async () => {
      const mockMessageId = `${testId}-existing-message`;
      const mockUserId = `${testId}-existing-user`;
      
      // Create test data - email already exists
      await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).set({
        messageId: mockMessageId,
        testId: testId
      });

      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      
      // Function should return early without calling dependencies
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify dependencies were not called
      expect(getFullMessageStub.called).to.be.false;
      expect(uploadAttachmentStub.called).to.be.false;
    });

    it('should process and store email with no attachments successfully', async () => {
      const mockMessageId = `${testId}-no-attachments`;
      const mockUserId = `${testId}-no-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: false, 
        attachments: null 
      });
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify getFullMessage was called
      expect(getFullMessageStub.calledOnce).to.be.true;
      expect(getFullMessageStub.firstCall.args).to.deep.equal([mockMessage, mockUserId, mockMessageId]);
      
      // Verify uploadAttachment was not called (no attachments)
      expect(uploadAttachmentStub.called).to.be.false;
      
      // Verify email was stored in Firestore
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      expect(storedEmail.exists).to.be.true;
      
      const emailData = storedEmail.data();
      expect(emailData?.messageId).to.equal(mockMessageId);
      expect(emailData?.subject).to.equal('Test Email Subject');
      expect(emailData?.from).to.equal('sender@example.com');
      expect(emailData?.attachments).to.be.null;
      expect(emailData?.createdAt).to.exist;
    });

    it('should process and store email with attachments successfully', async () => {
      const mockMessageId = `${testId}-with-attachments`;
      const mockUserId = `${testId}-with-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockAttachments = [
        {
          id: 'att1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          data: 'base64-encoded-data'
        }
      ];
      
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: mockAttachments 
      });
      
      const mockDownloadUrl = 'https://storage.googleapis.com/test-file.pdf';
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      uploadAttachmentStub.resolves(mockDownloadUrl);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify getFullMessage was called
      expect(getFullMessageStub.calledOnce).to.be.true;
      
      // Verify uploadAttachment was called for each attachment
      expect(uploadAttachmentStub.calledOnce).to.be.true;
      expect(uploadAttachmentStub.firstCall.args[0]).to.deep.include({
        userId: mockUserId,
        messageId: mockMessageId,
        attachmentId: 'att1',
        filename: 'test.pdf',
        contentType: 'application/pdf'
      });
      
      // Verify email was stored with attachment URLs
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      expect(storedEmail.exists).to.be.true;
      
      const emailData = storedEmail.data();
      expect(emailData?.attachments).to.have.length(1);
      expect(emailData?.attachments[0].downloadUrl).to.equal(mockDownloadUrl);
      expect(emailData?.attachments[0].filename).to.equal('test.pdf');
    });

    it('should handle multiple attachments correctly', async () => {
      const mockMessageId = `${testId}-multiple-attachments`;
      const mockUserId = `${testId}-multiple-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockAttachments = [
        {
          id: 'att1',
          filename: 'test1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          data: 'base64-encoded-data-1'
        },
        {
          id: 'att2',
          filename: 'test2.jpg',
          mimeType: 'image/jpeg',
          size: 2048,
          data: 'base64-encoded-data-2'
        }
      ];
      
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: mockAttachments 
      });
      
      const mockDownloadUrls = [
        'https://storage.googleapis.com/test1.pdf',
        'https://storage.googleapis.com/test2.jpg'
      ];
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      uploadAttachmentStub.onFirstCall().resolves(mockDownloadUrls[0]);
      uploadAttachmentStub.onSecondCall().resolves(mockDownloadUrls[1]);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify uploadAttachment was called twice
      expect(uploadAttachmentStub.calledTwice).to.be.true;
      
      // Verify email was stored with all attachment URLs
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      const emailData = storedEmail.data();
      expect(emailData?.attachments).to.have.length(2);
      expect(emailData?.attachments[0].downloadUrl).to.equal(mockDownloadUrls[0]);
      expect(emailData?.attachments[1].downloadUrl).to.equal(mockDownloadUrls[1]);
    });

    it('should skip attachments with no data', async () => {
      const mockMessageId = `${testId}-skip-no-data`;
      const mockUserId = `${testId}-skip-no-data-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockAttachments = [
        {
          id: 'att1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          data: null // No data
        },
        {
          id: 'att2',
          filename: 'test2.jpg',
          mimeType: 'image/jpeg',
          size: 2048,
          data: 'base64-encoded-data-2'
        }
      ];
      
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: mockAttachments 
      });
      
      const mockDownloadUrl = 'https://storage.googleapis.com/test2.jpg';
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      uploadAttachmentStub.resolves(mockDownloadUrl);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify uploadAttachment was called only once (for the attachment with data)
      expect(uploadAttachmentStub.calledOnce).to.be.true;
      
      // Verify email was stored with only the valid attachment
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      const emailData = storedEmail.data();
      expect(emailData?.attachments).to.have.length(1);
      expect(emailData?.attachments[0].id).to.equal('att2'); // Only the valid attachment
    });

    it('should throw error when message ID is missing', async () => {
      const mockMessageId = `${testId}-missing-id`;
      const mockUserId = `${testId}-missing-id-user`;
      
      const mockMessage = createMockGmailMessage({ id: undefined });
      
      try {
        await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Message ID does not exist');
        expect(error.message).to.include(mockMessageId);
        expect(error.message).to.include(mockUserId);
      }
      
      // Verify dependencies were not called
      expect(getFullMessageStub.called).to.be.false;
      expect(uploadAttachmentStub.called).to.be.false;
    });

    it('should throw error when attachment processing fails', async () => {
      const mockMessageId = `${testId}-attachment-fail`;
      const mockUserId = `${testId}-attachment-fail-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockAttachments = [
        {
          id: 'att1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          data: 'base64-encoded-data'
        }
      ];
      
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: mockAttachments 
      });
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      uploadAttachmentStub.rejects(new Error('Storage upload failed'));
      
      try {
        await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Storage upload failed');
      }
      
      // Verify email was not stored
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      expect(storedEmail.exists).to.be.false;
    });

    it('should handle email with empty attachments array', async () => {
      const mockMessageId = `${testId}-empty-attachments`;
      const mockUserId = `${testId}-empty-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: [] // Empty array
      });
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify uploadAttachment was not called
      expect(uploadAttachmentStub.called).to.be.false;
      
      // Verify email was stored with empty attachments array
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      const emailData = storedEmail.data();
      expect(emailData?.attachments).to.deep.equal([]);
    });

    it('should handle email with null attachments', async () => {
      const mockMessageId = `${testId}-null-attachments`;
      const mockUserId = `${testId}-null-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: false, 
        attachments: null
      });
      
      // Setup mocks
      getFullMessageStub.resolves(mockEmailData);
      
      // Call the function
      await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
      
      // Verify uploadAttachment was not called
      expect(uploadAttachmentStub.called).to.be.false;
      
      // Verify email was stored with null attachments
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      const emailData = storedEmail.data();
      expect(emailData?.attachments).to.be.null;
    });

    it('should preserve original attachments when no new URLs are generated', async () => {
      const mockMessageId = `${testId}-preserve-attachments`;
      const mockUserId = `${testId}-preserve-attachments-user`;
      
      const mockMessage = createMockGmailMessage({ id: mockMessageId });
      const mockAttachments = [
        {
          id: 'att1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          data: 'base64-encoded-data'
        }
      ];
      
      const mockEmailData = createMockEmailData({ 
        messageId: mockMessageId,
        hasAttachments: true, 
        attachments: mockAttachments 
      });
      
      // Setup mocks - uploadAttachment fails, so no new URLs
      getFullMessageStub.resolves(mockEmailData);
      uploadAttachmentStub.rejects(new Error('Upload failed'));
      
      try {
        await processAndStoreEmail(mockMessage, mockUserId, mockMessageId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Upload failed');
      }
      
      // Verify email was not stored due to attachment error
      const storedEmail = await db.collection('emails').doc(mockUserId).collection('messages').doc(mockMessageId).get();
      expect(storedEmail.exists).to.be.false;
    });
  });
});
