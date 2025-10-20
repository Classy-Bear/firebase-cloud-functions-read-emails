import { expect, sinon, cleanupTestData, generateTestId } from '../setup';
import * as admin from 'firebase-admin';
import { onNewPendingMessageFunction } from '../../src/functions/onNewPendingMessage';
import * as gmailHelper from '../../src/helpers/gmail';
import * as dbHelper from '../../src/helpers/db';

describe('onNewPendingMessageFunction', () => {
  let testId: string;
  let db: admin.firestore.Firestore;
  let getLatestMessagesStub: sinon.SinonStub;
  let getMessageStub: sinon.SinonStub;
  let processAndStoreEmailStub: sinon.SinonStub;

  before(async () => {
    db = admin.firestore();
    testId = generateTestId();
  });

  beforeEach(() => {
    sinon.restore();

    getLatestMessagesStub = sinon.stub(gmailHelper, 'getLatestMessages');
    getMessageStub = sinon.stub(gmailHelper, 'getMessage');
    processAndStoreEmailStub = sinon.stub(dbHelper, 'processAndStoreEmail');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('users', testId);
    await cleanupTestData('pending-messages', testId);
  });

  it('should process pending message successfully', async () => {
    const testUid = `${testId}-user`;
    const uniqueEmail = `test-${testId}@example.com`;
    const mockEvent = {
      data: {
        data: () => ({
          emailAddress: uniqueEmail,
          historyId: '12345'
        }),
        ref: { update: () => Promise.resolve() }
      },
      id: 'test-doc-id'
    };

    // Create test user in Firestore
    await db.collection('users').doc(testUid).set({
      uid: testUid,
      email: uniqueEmail,
      historyId: '12340',
      testId: testId
    });

    const mockMessageIds = ['msg1', 'msg2'];
    const mockMessageData = { id: 'msg1', snippet: 'Test email' };

    getLatestMessagesStub.resolves(mockMessageIds);
    getMessageStub.resolves(mockMessageData);
    processAndStoreEmailStub.resolves();

    await onNewPendingMessageFunction(mockEvent as any);

    expect(getLatestMessagesStub.calledWith(testUid, '12340')).to.be.true;
    expect(getMessageStub.calledTwice).to.be.true;
    expect(processAndStoreEmailStub.calledTwice).to.be.true;

    // Verify the user's historyId was updated
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.data()?.historyId).to.equal('12345');
  });

  it('should handle missing emailAddress gracefully and update pending message', async () => {
    const mockId = 'test-missing-emailAddress-doc-id';
    const emailAddress = `test-missing-emailAddress-${testId}@example.com`;
    const historyId = '12345';
    const status = 'pending';
    const attempts = 0;
    // Create the pending message
    await db.collection('pending-messages').doc(mockId).set({
      emailAddress,
      historyId,
      status,
      attempts
    });
    // Create the event
    const mockEvent = {
      data: {
        data: () => ({ historyId, status, attempts }),
        ref: {
          update: async (data: any) => {
            await db.collection('pending-messages').doc(mockId).update(data);
          }
        }
      },
      id: mockId
    };
    // Call the function
    await onNewPendingMessageFunction(mockEvent as any);
    // Verify the pending message was updated with error
    const userDoc = await db.collection('pending-messages').doc(mockId).get();
    expect(userDoc.data()?.status).to.equal('error');
    expect(userDoc.data()?.errorMessage).to.equal('Missing required data in pending message document ' + JSON.stringify(mockEvent.data.data()));
    expect(userDoc.data()?.updatedAt).to.be.instanceOf(admin.firestore.Timestamp);
    expect(userDoc.data()?.attempts).to.equal(1);
  });

  it('should handle missing historyId gracefully and update pending message', async () => {
    const mockId = 'test-missing-historyId-doc-id';
    const emailAddress = `test-missing-historyId-${testId}@example.com`;
    const status = 'pending';
    const attempts = 0;
    // Create the pending message
    await db.collection('pending-messages').doc(mockId).set({
      emailAddress,
      status,
      attempts
    });
    // Create the event
    const mockEvent = {
      data: {
        data: () => ({ emailAddress,  status, attempts }),
        ref: {
          update: async (data: any) => {
            await db.collection('pending-messages').doc(mockId).update(data);
          }
        }
      },
      id: mockId
    };
    // Call the function
    await onNewPendingMessageFunction(mockEvent as any);
    // Verify the pending message was updated
    const userDoc = await db.collection('pending-messages').doc(mockId).get();
    expect(userDoc.data()?.status).to.equal('error');
    expect(userDoc.data()?.errorMessage).to.equal('Missing required data in pending message document ' + JSON.stringify(mockEvent.data.data()));
    expect(userDoc.data()?.updatedAt).to.be.instanceOf(admin.firestore.Timestamp);
    expect(userDoc.data()?.attempts).to.equal(1);
  });

  it('should handle user not found gracefully and update pending message', async () => {
    const emailAddress = `test-not-found-${testId}@example.com`;
    const mockId = 'test-not-found-doc-id';
    const historyId = '12345';
    const status = 'pending';
    const attempts = 0;
    // Create the pending message
    await db.collection('pending-messages').doc(mockId).set({
      emailAddress,
      historyId,
      status,
      attempts
    });
    // Create the event
    const mockEvent = {
      data: {
        data: () => ({
          emailAddress,
          historyId,
          status,
          attempts
        }),
        ref: {
          update: async (data: any) => {
            await db.collection('pending-messages').doc(mockId).update(data);
          }
        }
      },
      id: mockId
    };
    // Reject the getLatestMessagesStub
    getLatestMessagesStub.rejects(new Error('User not found'));
    // Call the function
    await onNewPendingMessageFunction(mockEvent as any);
    // Verify the pending message was updated with error
    const userDoc = await db.collection('pending-messages').doc(mockId).get();
    expect(userDoc.data()?.status).to.equal('error');
    expect(userDoc.data()?.errorMessage).to.equal('Error handling new pending message ' + JSON.stringify(new Error('User not found')));
    expect(userDoc.data()?.updatedAt).to.be.instanceOf(admin.firestore.Timestamp);
    expect(userDoc.data()?.attempts).to.equal(1);
  });

  it('should handle getMessage errors gracefully and update pending message', async () => {
    const mockId = 'test-getMessage-error-doc-id';
    const emailAddress = `test-getMessage-error-${testId}@example.com`;
    const historyId = '12345';
    const status = 'pending';
    const attempts = 0;
    // Create the pending message
    await db.collection('pending-messages').doc(mockId).set({
      emailAddress,
      historyId,
      status,
      attempts
    });
    // Create the event
    const mockEvent = {
      data: {
        data: () => ({
          emailAddress,
          historyId,
          status,
          attempts
        }),
        ref: {
          update: async (data: any) => {
            await db.collection('pending-messages').doc(mockId).update(data);
          }
        }
      },
      id: mockId
    };
    // Reject the getMessageStub
    getMessageStub.rejects(new Error('getMessage error'));
    // Call the function
    await onNewPendingMessageFunction(mockEvent as any);
    // Verify the pending message was updated
    const userDoc = await db.collection('pending-messages').doc(mockId).get();
    expect(userDoc.data()?.status).to.equal('error');
    expect(userDoc.data()?.errorMessage).to.equal('Error handling new pending message ' + JSON.stringify(new Error('getMessage error')));
    expect(userDoc.data()?.updatedAt).to.be.instanceOf(admin.firestore.Timestamp);
    expect(userDoc.data()?.attempts).to.equal(1);
  });

  it('should handle processAndStoreEmail errors gracefully and update pending message', async () => {
    const mockId = 'test-processAndStoreEmail-error-doc-id';
    const emailAddress = `test-processAndStoreEmail-error-${testId}@example.com`;
    const historyId = '12345';
    const status = 'pending';
    const attempts = 0;
    // Create the pending message
    await db.collection('pending-messages').doc(mockId).set({
      emailAddress,
      historyId,
      status,
      attempts
    });
    const mockEvent = {
      data: {
        data: () => ({
          emailAddress,
          historyId,
          status,
          attempts
        }),
        ref: {
          update: async (data: any) => {
            await db.collection('pending-messages').doc(mockId).update(data);
          }
        }
      },
      id: mockId
    };
    // Reject the processAndStoreEmailStub
    processAndStoreEmailStub.rejects(new Error('processAndStoreEmail error'));
    // Call the function
    await onNewPendingMessageFunction(mockEvent as any);
    // Verify the pending message was updated
    const userDoc = await db.collection('pending-messages').doc(mockId).get();
    expect(userDoc.data()?.status).to.equal('error');
    expect(userDoc.data()?.errorMessage).to.equal('Error handling new pending message ' + JSON.stringify(new Error('processAndStoreEmail error')));
    expect(userDoc.data()?.updatedAt).to.be.instanceOf(admin.firestore.Timestamp);
    expect(userDoc.data()?.attempts).to.equal(1);
  });
});
