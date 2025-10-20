# Comprehensive Test Todo List - Current Status

This document contains a complete list of all test cases in the Firebase Cloud Functions project with their current status after test execution.

## Test Summary
- **23 tests passing** - Tests are properly implemented and functioning correctly
- **25 tests failing** - Primarily due to Firebase initialization issues in test environment

## Helper Modules Tests

### Database Helpers (db.test.ts) - ALL FAILING ❌
**Reason:** Firebase app not initialized - "The default Firebase app does not exist" error
- [ ] `getRefreshToken`: return refresh token when document exists
- [ ] `getRefreshToken`: throw error when document does not exist
- [ ] `getRefreshToken`: throw error when refresh token is missing
- [ ] `storeRefreshToken`: store refresh token successfully
- [ ] `storeRefreshToken`: handle Firestore errors
- [ ] `addUserToDb`: add user to database successfully
- [ ] `getUserFromDb`: return user when document exists
- [ ] `getUserFromDb`: throw error when user does not exist
- [ ] `getUserFromDb`: throw error when user data is missing
- [ ] `updateHistoryIdInDb`: update history ID successfully
- [ ] `updateHistoryIdInDb`: throw error when user does not exist

### HTTP Utilities (httpv2.test.ts) - ALL PASSING ✅
- [x] `getCredentials`: return uid when user is authenticated
- [x] `getCredentials`: throw error when uid is missing

### Gmail Helpers (gmail.test.ts) - ALL PASSING ✅
- [x] `createGmailClient`: should create and return authorized Gmail client
- [x] `createGmailClient`: should throw error when refresh token is missing
- [x] `exchangeAuthCodeForRefreshToken`: should exchange auth code for tokens successfully
- [x] `exchangeAuthCodeForRefreshToken`: should throw error when token exchange fails
- [x] `exchangeAuthCodeForRefreshToken`: should throw error when tokens are missing

### Storage Helpers (storage.test.ts) - ALL FAILING ❌
**Reason:** Firebase app not initialized - "The default Firebase app does not exist" error
- [ ] `uploadAttachment`: should upload attachment successfully
- [ ] `uploadAttachment`: should handle upload errors gracefully

## Cloud Functions Tests

### addUserToDbFunction (addUserToDb.test.ts) - ALL FAILING ❌
**Reason:** Assertion errors - Expected true but got false
- [ ] `addUserToDbFunction`: should add user to database when authenticated with Google
- [ ] `addUserToDbFunction`: should skip user when not authenticated with Google
- [ ] `addUserToDbFunction`: should handle database errors gracefully
- [ ] `addUserToDbFunction`: should handle empty provider data

### storeRefreshTokenFunction (storeRefreshToken.test.ts) - ALL PASSING ✅
- [x] `storeRefreshTokenFunction`: should store refresh token successfully with valid auth code
- [x] `storeRefreshTokenFunction`: should throw HttpsError when authentication fails
- [x] `storeRefreshTokenFunction`: should throw HttpsError when auth code exchange fails
- [x] `storeRefreshTokenFunction`: should throw HttpsError when database storage fails
- [x] `storeRefreshTokenFunction`: should throw HttpsError when auth code is missing

### startEmailWatchingFunction (startEmailWatching.test.ts) - MIXED RESULTS 🔄
- [x] `startEmailWatchingFunction`: should start email watching successfully
- [ ] `startEmailWatchingFunction`: should throw HttpsError when uid is missing - **Assertion error: expected undefined to equal 'internal'**
- [x] `startEmailWatchingFunction`: should throw HttpsError when createGmailClient fails
- [x] `startEmailWatchingFunction`: should throw HttpsError when watchGmail fails
- [ ] `startEmailWatchingFunction`: should throw HttpsError when user is not authenticated - **Assertion error: expected undefined to equal 'internal'**

### getEmailsFunction (getEmails.test.ts) - MIXED RESULTS 🔄
- [ ] `getEmailsFunction`: should fetch emails successfully - **Error: Error listing messages on getEmailsFunction**
- [x] `getEmailsFunction`: should handle empty message results
- [x] `getEmailsFunction`: should throw HttpsError when user is not authenticated
- [x] `getEmailsFunction`: should throw HttpsError when user is not found in database
- [x] `getEmailsFunction`: should throw HttpsError when Gmail API fails

### onNewMessageFunction (onNewMessage.test.ts) - MIXED RESULTS 🔄
- [ ] `onNewMessageFunction`: should process valid Gmail push notification - **Firebase app not initialized error**
- [x] `onNewMessageFunction`: should handle missing emailAddress gracefully
- [x] `onNewMessageFunction`: should handle missing historyId gracefully
- [x] `onNewMessageFunction`: should handle malformed JSON gracefully
- [ ] `onNewMessageFunction`: should handle Firestore write errors gracefully - **Firebase app not initialized error**

### onNewPendingMessageFunction (onNewPendingMessage.test.ts) - MIXED RESULTS 🔄
- [ ] `onNewPendingMessageFunction`: should process pending message successfully - **Firebase app not initialized error**
- [x] `onNewPendingMessageFunction`: should handle missing emailAddress gracefully
- [ ] `onNewPendingMessageFunction`: should handle user not found gracefully - **Firebase app not initialized error**
- [ ] `onNewPendingMessageFunction`: should handle Gmail API errors gracefully - **Firebase app not initialized error**

## Root Cause Analysis

The primary issue causing test failures is **Firebase initialization conflict**. The source code contains top-level Firebase initialization:

```typescript
// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp();
}
```

However, the test environment stubs `admin.initializeApp` to prevent actual initialization, leading to services like Firestore and Storage failing with "app/no-app" errors.

## Recommended Fixes

1. **Refactor Source Code**: Modify Firebase service usage to use lazy initialization patterns instead of top-level initialization
2. **Improve Test Stubs**: Enhance test setup to properly mock all Firebase services before source code imports
3. **Use Dependency Injection**: Consider refactoring to inject Firebase services for better testability
4. **Module Mocking**: Use tools like `proxyquire` to mock dependencies during import

## Immediate Next Steps

1. Focus on fixing Firebase initialization in test environment
2. Address assertion errors in failing tests
3. Run tests after each fix to verify improvements
4. Update this todo list as tests are fixed

## Current Test Statistics
- **Total Tests:** 48
- **Passing:** 23 (47.9%)
- **Failing:** 25 (52.1%)
- **Primary Issue:** Firebase initialization conflicts in test environment
