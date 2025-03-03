# Gmail Email Listener with Firebase

This project implements a Firebase Cloud Function that listens for incoming emails using the Gmail API and stores them in Firestore. The function authenticates users through Firebase Authentication and uses their Google credentials to access their Gmail account.

## Features

- Real-time email monitoring using Gmail API
- Firebase Authentication with Google provider
- Automatic email storage in Firestore with support for multiple formats
- Secure attachment handling and storage in Firebase Storage
- Secure token handling and authentication
- OAuth2 authorization code exchange for secure token management
- Automatic refresh token storage and management
- Pending messages queue for reliable processing
- Comprehensive error handling and logging
- Granular security rules for both Firestore and Storage

## Prerequisites

- Node.js 22 or later
- Firebase CLI
- A Google Cloud Project with Gmail API enabled
- Firebase project with Authentication, Firestore, and Storage enabled

## Setup

1. Enable Gmail API in your Google Cloud Console
2. Configure Firebase Authentication with Google provider
3. Set up OAuth2 credentials in Google Cloud Console:
   - Configure authorized redirect URIs
   - Note down your client ID and client secret
4. Configure environment variables:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=your_redirect_uri
   ```
5. Set up Firebase Storage rules for secure attachment access
6. Deploy the Firebase function:
   ```bash
   firebase deploy --only functions
   ```

## Architecture

The system works as follows:

1. User authenticates with Firebase using their Google account
2. User authorizes the application using OAuth2:
   - Application receives authorization code
   - Code is exchanged for access and refresh tokens
   - Refresh token is securely stored in Firestore
3. The function uses the stored refresh token to maintain Gmail API access
4. When new emails arrive:
   - A pending message document is created in the 'pending-messages' collection
   - A Cloud Function triggers on document creation to process the email
   - Email content is parsed and stored in Firestore
   - Attachments are processed and stored in Firebase Storage
   - Download URLs for attachments are stored with email metadata
   - User's historyId is updated to track latest changes
5. Each email is stored with:
   - Basic metadata (subject, from, to, date)
   - Email body in both HTML and text formats
   - Attachment metadata and secure download URLs
   - Labels and other Gmail-specific information

## Security

- All authentication is handled through Firebase Authentication
- Tokens are securely managed and never exposed
- OAuth2 refresh tokens are stored securely in Firestore
- Only authenticated users can access their own emails and attachments
- Firestore security rules ensure data privacy
- Storage security rules protect attachment access
- All sensitive operations are logged for audit purposes

## Logging

The application uses Firebase Cloud Functions logging for all operations:
- Detailed error tracking with stack traces
- Operation success/failure logging
- Performance monitoring
- User action auditing
- Email processing status updates

All logs can be monitored and analyzed through the Firebase Console.

