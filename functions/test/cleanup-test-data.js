#!/usr/bin/env node

/**
 * Test Data Cleanup Script
 * 
 * This script cleans up test data from the Firebase project.
 * It removes all documents with testId fields that are older than 24 hours.
 * 
 * Usage: npm run test:cleanup
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
const serviceAccount = require('../fir-emails-940ea-2a9ff4df5dbf.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://fir-emails-940ea.firebaseio.com',
    storageBucket: 'fir-emails-940ea.firebasestorage.app',
    projectId: 'fir-emails-940ea'
  });
}

const db = admin.firestore();
const storage = admin.storage();

async function cleanupTestData() {
  console.log('🧹 Starting test data cleanup...');
  
  try {
    // Collections to clean up
    const collections = ['users', 'gmail_tokens', 'pending-messages', 'emails'];
    
    for (const collectionName of collections) {
      console.log(`📁 Cleaning up collection: ${collectionName}`);
      
      if (collectionName === 'emails') {
        // Handle nested emails collection structure
        await cleanupEmailsCollection();
      } else {
        // Handle regular collections
        await cleanupRegularCollection(collectionName);
      }
    }
    
    // Clean up test storage files
    console.log('🗂️  Cleaning up test storage files...');
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: 'attachments/test-' });
    
    if (files.length > 0) {
      console.log(`   Found ${files.length} test files in storage`);
      await bucket.deleteFiles({ prefix: 'attachments/test-' });
      console.log(`   ✅ Deleted ${files.length} test files from storage`);
    } else {
      console.log('   No test files found in storage');
    }
    
    console.log('🎉 Test data cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test data cleanup:', error);
    process.exit(1);
  }
}

async function cleanupRegularCollection(collectionName) {
  // Find documents with testId field
  const snapshot = await db.collection(collectionName)
    .where('testId', '!=', null)
    .get();
  
  if (snapshot.empty) {
    console.log(`   No test documents found in ${collectionName}`);
    return;
  }
  
  console.log(`   Found ${snapshot.docs.length} test documents in ${collectionName}`);
  
  // Delete documents in batches
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`   ✅ Deleted ${snapshot.docs.length} test documents from ${collectionName}`);
}

async function cleanupEmailsCollection() {
  // Find all email documents with testId
  const snapshot = await db.collection('emails')
    .where('testId', '!=', null)
    .get();
  
  if (snapshot.empty) {
    console.log('   No test email documents found');
    return;
  }
  
  console.log(`   Found ${snapshot.docs.length} test email documents`);
  
  // Delete documents in batches
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`   ✅ Deleted ${snapshot.docs.length} test email documents`);
  
  // Also clean up emails collection by looking for test IDs in the user ID
  const allEmailsSnapshot = await db.collection('emails').get();
  let deletedCount = 0;
  
  for (const userDoc of allEmailsSnapshot.docs) {
    const userId = userDoc.id;
    if (userId.startsWith('test-')) {
      // This is a test user, clean up all their emails
      const messagesSnapshot = await userDoc.ref.collection('messages').get();
      
      if (!messagesSnapshot.empty) {
        const messageBatch = db.batch();
        messagesSnapshot.docs.forEach(messageDoc => {
          messageBatch.delete(messageDoc.ref);
        });
        await messageBatch.commit();
        deletedCount += messagesSnapshot.docs.length;
      }
      
      // Delete the user document itself
      await userDoc.ref.delete();
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`   ✅ Cleaned up ${deletedCount} test email documents and messages`);
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupTestData()
    .then(() => {
      console.log('✨ Cleanup script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupTestData };
