import firebaseFunctionsTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';
import * as sinon from 'sinon';
import { expect } from 'chai';
import * as path from 'path';
import 'mocha'; // Add this line to import Mocha types

// Initialize firebase-functions-test in ONLINE mode with service account
export const test = firebaseFunctionsTest({
  databaseURL: 'https://fir-emails-940ea.firebaseio.com',
  storageBucket: 'fir-emails-940ea.firebasestorage.app',
  projectId: 'fir-emails-940ea',
}, path.join(__dirname, '../fir-emails-940ea-2a9ff4df5dbf.json'));

// Initialize Firebase Admin for online mode testing
// This will use the service account credentials for real Firebase operations
if (!admin.apps.length) {
  admin.initializeApp();
}

// Keep only essential stubs for external APIs (Gmail, Google APIs)
// Remove Firebase Admin stubs since we're using online mode
const googleStub = {
  auth: {
    OAuth2: sinon.stub()
  },
  gmail: sinon.stub()
};

// Stub Google APIs to prevent real external API calls during testing
sinon.stub(require('googleapis'), 'google').value(googleStub);

// Set up test environment variables
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
process.env.MY_FIREBASE_PROJECT_NAME = 'fir-emails-940ea';

// Re-export commonly used testing utilities
export { expect };
export { sinon };
export { test as firebaseTest };
export { googleStub };

// Helper function to clean up test data
export const cleanupTestData = async (collection: string, testId: string) => {
  try {
    const db = admin.firestore();
    const query = db.collection(collection).where('testId', '==', testId);
    const snapshot = await query.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.warn('Test cleanup warning:', error);
  }
};

// Helper function to generate unique test IDs
export const generateTestId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
