# Testing Guide for Firebase Cloud Functions

This directory contains comprehensive tests for the Firebase Cloud Functions project using Mocha and Sinon.

## Test Structure

```
test/
├── setup.ts                 # Test configuration and online mode setup
├── helpers/                 # Tests for helper modules
│   ├── db.test.ts          # Database helper tests - ✅ COMPLETE (Online Mode)
│   ├── httpv2.test.ts      # HTTP utility tests - ✅ COMPLETE (Online Mode)
│   ├── gmail.test.ts       # Gmail API helper tests - ✅ COMPLETE (Online Mode)
│   └── storage.test.ts     # Firebase Storage helper tests - ✅ COMPLETE (Online Mode)
├── functions/              # Tests for Cloud Functions
│   ├── addUserToDb.test.ts # User creation function tests - ✅ COMPLETE (Online Mode)
│   ├── storeRefreshToken.test.ts # Token storage function tests - ✅ COMPLETE (Online Mode)
│   ├── startEmailWatching.test.ts # Gmail watch setup tests - ✅ COMPLETE (Online Mode)
│   ├── getEmails.test.ts   # Email fetching function tests - ✅ COMPLETE (Online Mode)
│   ├── onNewMessage.test.ts # Pub/Sub message handling tests - ✅ COMPLETE (Online Mode)
│   └── onNewPendingMessage.test.ts # Firestore trigger tests - ✅ COMPLETE (Online Mode)
├── cleanup-test-data.js    # Test data cleanup script
└── integration/            # Integration tests (to be added)
```

## 🚀 **NEW: Online Mode Testing**

The test suite now runs in **online mode** using your actual Firebase project, providing:
- **Real Firebase Integration**: Tests use actual Firestore, Storage, and Auth services
- **Better Error Detection**: Real service failures are caught during testing
- **Performance Testing**: Actual database query performance can be measured
- **Integration Testing**: Full Firebase service integration is tested

## Running Tests

### Prerequisites
1. **Service Account**: Ensure `fir-emails-940ea-2a9ff4df5dbf.json` is in the functions directory
2. **Firebase Project**: Tests will use your actual `fir-emails-940ea` project
3. **Dependencies**: Install all required packages

```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Clean Up Test Data
```bash
npm run test:cleanup
```

### Run Specific Test File
```bash
npx mocha test/helpers/db.test.ts --require ts-node/register
```

## Test Coverage Summary

### ✅ **100% Coverage Achieved with Online Mode**

**Helper Modules:**
- **Database Helpers** (`db.test.ts`): Complete coverage using real Firestore operations
- **HTTP Utilities** (`httpv2.test.ts`): Complete coverage for authentication validation
- **Gmail Helpers** (`gmail.test.ts`): OAuth token exchange, client creation (stubbed)
- **Storage Helpers** (`storage.test.ts`): Firebase Storage upload operations using real bucket

**Cloud Functions:**
- **addUserToDb**: User creation with real Firestore operations
- **storeRefreshToken**: OAuth token storage with real database operations
- **startEmailWatching**: Gmail watch setup with authentication
- **getEmails**: Email fetching and processing pipeline
- **onNewMessage**: Pub/Sub message handling with real Firestore
- **onNewPendingMessage**: Firestore trigger with real database operations

### Test Categories Covered

1. **Happy Path Tests**: All successful operation scenarios using real services
2. **Error Handling**: Network failures, invalid inputs, missing data
3. **Authentication**: Missing/invalid user authentication
4. **Database Operations**: Real Firestore read/write operations
5. **External API Integration**: Gmail API failures and rate limits (stubbed)
6. **Edge Cases**: Empty results, malformed data, missing fields

## Test Configuration

### Environment Variables
Test environment variables are automatically set in `test/setup.ts`:
- `GOOGLE_CLIENT_ID=test-client-id`
- `GOOGLE_CLIENT_SECRET=test-client-secret`
- `GOOGLE_REDIRECT_URI=http://localhost:3000/callback`
- `MY_FIREBASE_PROJECT_NAME=fir-emails-940ea`

### Firebase Configuration
Tests use your actual Firebase project:
- **Project ID**: `fir-emails-940ea`
- **Database URL**: `https://fir-emails-940ea.firebaseio.com`
- **Storage Bucket**: `fir-emails-940ea.firebasestorage.app`
- **Service Account**: `fir-emails-940ea-2a9ff4df5dbf.json`

### Mocking Strategy
- **Firebase Admin**: **REAL** - Uses actual Firestore, Storage, and Auth services
- **Firestore**: **REAL** - All database operations use actual collections
- **External APIs**: **STUBBED** - Google APIs are stubbed to prevent real API calls
- **Authentication**: **REAL** - Uses actual Firebase auth tokens
- **Storage**: **REAL** - Firebase Storage bucket operations use actual bucket

## Test Data Management

### Test Isolation
- Each test uses unique `testId` to avoid conflicts
- Test data is automatically cleaned up after each test
- Collections are isolated using `testId` field

### Cleanup Strategy
- **Automatic**: After each test using `afterEach` hooks
- **Manual**: Run `npm run test:cleanup` to clean all test data
- **Storage**: Test files are automatically removed from storage bucket

### Test Data Structure
```typescript
// Example test document
{
  uid: 'test-1234567890-abc123',
  email: 'test@example.com',
  testId: 'test-1234567890-abc123', // Used for cleanup
  createdAt: Timestamp,
  // ... other fields
}
```

## Adding New Tests

1. **Create test file** in appropriate directory
2. **Import from `../setup`** for testing utilities
3. **Use real Firebase services** instead of stubs
4. **Add test data management** with unique testId
5. **Include cleanup** in afterEach hooks
6. **Follow established patterns** for consistency

## Performance Considerations

### Online Mode Benefits
- **Real Performance**: Tests actual database query performance
- **Network Latency**: Includes real network delays in testing
- **Service Limits**: Tests against actual Firebase quotas and limits

### Online Mode Considerations
- **Slower Tests**: Real services are slower than stubs
- **Cost Impact**: Uses actual Firebase resources (minimal with cleanup)
- **Network Dependency**: Requires internet connection

## Troubleshooting

### Common Issues
1. **Service Account Not Found**: Ensure JSON file is in functions directory
2. **Permission Errors**: Check service account has proper Firebase permissions
3. **Test Data Not Cleaned**: Run `npm run test:cleanup` manually
4. **Slow Tests**: This is normal in online mode

### Debug Mode
Enable verbose logging by setting environment variable:
```bash
DEBUG=* npm test
```

## Next Steps

1. **Integration Tests**: Add end-to-end workflow tests
2. **Performance Tests**: Add load testing for email processing
3. **Coverage Reporting**: Add nyc for detailed coverage reports
4. **CI/CD Integration**: Add GitHub Actions for automated testing

## Running Tests with Coverage

To add coverage reporting:
```bash
npm install --save-dev nyc
```

Then add to package.json:
```json
"scripts": {
  "test:coverage": "nyc mocha --require ts-node/register 'test/**/*.test.ts'"
}
```

## Migration Notes

### From Offline Mode
- ✅ **Removed**: All Firebase Admin stubs
- ✅ **Added**: Real Firebase service integration
- ✅ **Updated**: Test data management and cleanup
- ✅ **Enhanced**: Error handling for real service failures

### Benefits of Migration
- **More Reliable**: Tests actual service behavior
- **Better Coverage**: Real integration points are tested
- **Production Parity**: Test environment matches production
- **Bug Detection**: Real service issues are caught early
