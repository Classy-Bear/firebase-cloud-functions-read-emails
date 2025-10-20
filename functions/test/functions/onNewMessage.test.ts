import { expect, cleanupTestData, generateTestId, firebaseTest } from '../setup';
import * as admin from 'firebase-admin';
import { onNewMessageFunction } from '../../src/functions/onNewMessage';
import { CloudEvent } from 'firebase-functions';
import { MessagePublishedData } from 'firebase-functions/pubsub';

describe('onNewMessageFunction', () => {
  let testId: string;
  let db: admin.firestore.Firestore;
  let historyId: string;
  let emailAddress: string;

  before(async () => {
    db = admin.firestore();
    testId = generateTestId();
  });

  beforeEach(async () => {
    historyId = Math.random().toString(36).substring(2, 15);
    emailAddress = `test-${Math.random().toString(36).substring(2, 15)}@example.com`;
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('pending-messages', testId);
  });

  // Helper function to create a mock PubSub event using Firebase test utilities
  const createMockEvent = (data: any): CloudEvent<MessagePublishedData<any>> => {
    // Handle undefined data by converting to empty object
    const safeData = data !== undefined ? data : {};
    
    // Use Firebase test utilities to create a proper PubSub message
    const pubsubMessage = firebaseTest.pubsub.makeMessage(safeData);
    
    // Convert the PubSub message to a CloudEvent format that the function expects
    return {
      id: 'test-event-id',
      source: 'test-source',
      specversion: '1.0',
      type: 'google.cloud.pubsub.topic.v1.messagePublished',
      time: new Date().toISOString(),
      data: {
        message: {
          data: pubsubMessage.data,
          attributes: pubsubMessage.attributes || {},
          messageId: 'test-message-id',
          publishTime: new Date().toISOString()
        },
        subscription: 'test-subscription'
      }
    } as CloudEvent<MessagePublishedData<any>>;
  };

  describe('successful message processing', () => {
    it('should process valid Gmail push notification', async () => {
      // Create a proper mock PubSub event
      const messageData = { emailAddress, historyId, testId };
      
      const mockEvent = createMockEvent(messageData);
      
      // Call the function directly
      await onNewMessageFunction(mockEvent);

      // Verify the pending message was created in Firestore
      const query = db.collection('pending-messages')
        .where('emailAddress', '==', emailAddress)
        .where('historyId', '==', historyId);
      
      const snapshot = await query.get();
      expect(snapshot.empty).to.be.false;
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      expect(data.emailAddress).to.equal(emailAddress);
      expect(data.historyId).to.equal(historyId);
      expect(data.status).to.equal('pending');
      expect(data.attempts).to.equal(0);
      expect(data.createdAt).to.exist;
    });
  });

  describe('error handling', () => {
    it('should handle missing emailAddress gracefully - no document created', async () => {
      // Create message with missing emailAddress
      const messageData = {
        historyId: historyId,
        testId: testId
      };
      
      const mockEvent = createMockEvent(messageData);
      
      // Call the function directly
      await onNewMessageFunction(mockEvent);
      
      // Verify NO document was created when emailAddress is missing
      const query = db.collection('pending-messages')
        .where('historyId', '==', historyId);
      
      const snapshot = await query.get();
      expect(snapshot.empty).to.be.true;
    });

    it('should handle missing historyId gracefully - no document created', async () => {
      // Create message with missing historyId
      const messageData = {
        emailAddress: emailAddress,
        testId: testId
      };
      
      const mockEvent = createMockEvent(messageData);
      
      // Call the function directly
      await onNewMessageFunction(mockEvent);
      
      // Verify NO document was created when historyId is missing
      const query = db.collection('pending-messages')
        .where('emailAddress', '==', emailAddress);
      
      const snapshot = await query.get();
      expect(snapshot.empty).to.be.true;
    });

    it('should handle malformed JSON gracefully', async () => {
      // Create message with malformed JSON data
      const malformedData = 'invalid-json-data';
      const mockEvent = createMockEvent(malformedData);
      
      // Call the function directly
      await onNewMessageFunction(mockEvent);
      
      // Should not create any documents when JSON is malformed
      const query = db.collection('pending-messages')
        .where('testId', '==', testId);
      
      const snapshot = await query.get();
      expect(snapshot.empty).to.be.true;
    });

    it('should handle empty message data gracefully', async () => {
      // Create message with empty data
      const mockEvent = createMockEvent({});
      
      // Call the function directly
      await onNewMessageFunction(mockEvent);
      
      // Should not create any documents when data is empty
      const query = db.collection('pending-messages')
        .where('testId', '==', testId);
      
      const snapshot = await query.get();
      expect(snapshot.empty).to.be.true;
    });
  });
});
