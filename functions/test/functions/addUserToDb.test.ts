import { expect, cleanupTestData, generateTestId } from '../setup';
import { addUserToDbFunction } from '../../src/functions/addUserToDb';
import * as admin from 'firebase-admin';

describe('addUserToDbFunction', () => {
  let testId: string;
  let db: admin.firestore.Firestore;

  before(async () => {
    db = admin.firestore();
    testId = generateTestId();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('users', testId);
  });

  it('should add user to database when authenticated with Google and return success response', async () => {
    const testUid = `${testId}-user`;
    const mockUser = {
      uid: testUid,
      email: 'test@example.com',
      providerData: [
        { 
          providerId: 'google.com', 
          uid: 'google-uid',
          toJSON: () => ({ providerId: 'google.com', uid: 'google-uid' })
        }
      ]
    } as any; // Use any to avoid complex type casting

    const result = await addUserToDbFunction(mockUser);

    // Verify the function returns success response
    expect(result.success).to.be.true;
    expect(result.userInfo).to.be.an('array');
    expect(result.userInfo).to.have.length(1);
    expect(result.userInfo[0]).to.deep.equal({ providerId: 'google.com', uid: 'google-uid' });
    expect(result.error).to.be.undefined;

    // Verify the user was added to the database
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.exists).to.be.true;
    expect(userDoc.data()?.email).to.equal('test@example.com');
    expect(userDoc.data()?.uid).to.equal(testUid);
    expect(userDoc.data()?.createdAt).to.exist;
  });

  it('should skip user when not authenticated with Google and return failure response', async () => {
    const testUid = `${testId}-user-not-google`;
    const mockUser = {
      uid: testUid,
      email: 'test@example.com',
      providerData: [
        { 
          providerId: 'none', 
          uid: 'none-uid',
          toJSON: () => ({ providerId: 'none', uid: 'none-uid' })
        }
      ]
    } as any; // Use any to avoid complex type casting

    const result = await addUserToDbFunction(mockUser);

    // Verify the function returns failure response
    expect(result.success).to.be.false;
    expect(result.userInfo).to.be.an('array');
    expect(result.userInfo).to.have.length(1);
    expect(result.userInfo[0]).to.deep.equal({ providerId: 'none', uid: 'none-uid' });
    expect(result.error).to.be.undefined;

    // Verify no user was added to the database
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.exists).to.be.false;
  });

  it('should handle empty provider data gracefully and return failure response', async () => {
    const testUid = `${testId}-user-no-provider`;
    const mockUser = {
      uid: testUid,
      email: 'test@example.com',
      providerData: []
    } as any; // Use any to avoid complex type casting

    const result = await addUserToDbFunction(mockUser);

    // Verify the function returns failure response
    expect(result.success).to.be.false;
    expect(result.userInfo).to.be.an('array');
    expect(result.userInfo).to.have.length(0);
    expect(result.error).to.be.undefined;

    // Verify no user was added to the database
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.exists).to.be.false;
  });

  it('should handle multiple providers and return correct userInfo', async () => {
    const testUid = `${testId}-user-multiple-providers`;
    const mockUser = {
      uid: testUid,
      email: 'test@example.com',
      providerData: [
        { 
          providerId: 'google.com', 
          uid: 'google-uid',
          toJSON: () => ({ providerId: 'google.com', uid: 'google-uid' })
        },
        { 
          providerId: 'facebook.com', 
          uid: 'facebook-uid',
          toJSON: () => ({ providerId: 'facebook.com', uid: 'facebook-uid' })
        }
      ]
    } as any; // Use any to avoid complex type casting

    const result = await addUserToDbFunction(mockUser);

    // Verify the function returns success response with all provider data
    expect(result.success).to.be.true;
    expect(result.userInfo).to.be.an('array');
    expect(result.userInfo).to.have.length(2);
    expect(result.userInfo).to.deep.include({ providerId: 'google.com', uid: 'google-uid' });
    expect(result.userInfo).to.deep.include({ providerId: 'facebook.com', uid: 'facebook-uid' });
    expect(result.error).to.be.undefined;

    // Verify the user was added to the database
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.exists).to.be.true;
  });
});
