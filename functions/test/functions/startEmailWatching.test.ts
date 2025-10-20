import { expect, sinon, cleanupTestData, generateTestId } from '../setup';
import * as functionsv2 from 'firebase-functions/v2';
import { startEmailWatchingFunction } from '../../src/functions/startEmailWatching';
import * as gmailHelper from '../../src/helpers/gmail';

describe('startEmailWatchingFunction', () => {
  let testId: string;
  let createGmailClientStub: sinon.SinonStub;
  let watchGmailStub: sinon.SinonStub;

  before(async () => {
    testId = generateTestId();
  });

  beforeEach(() => {
    sinon.restore();
    
    createGmailClientStub = sinon.stub(gmailHelper, 'createGmailClient');
    watchGmailStub = sinon.stub(gmailHelper, 'watchGmail');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('users', testId);
  });

  describe('successful email watching setup', () => {
    it('should start email watching successfully', async () => {
      const testUid = `${testId}-user`;
      const mockRequest = {
        data: { uid: testUid },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      const mockOAuthClient = { /* mock OAuth2Client */ };
      createGmailClientStub.resolves(mockOAuthClient);
      watchGmailStub.resolves();

      const result = await startEmailWatchingFunction(mockRequest);

      expect(createGmailClientStub.calledWith(testUid)).to.be.true;
      expect(watchGmailStub.calledWith(testUid, mockOAuthClient)).to.be.true;
      expect(result).to.deep.equal({ success: true });
    });
  });

  describe('error handling', () => {
    it('should throw HttpsError when uid is missing', async () => {
      const testUid = `${testId}-user-no-uid`;
      const mockRequest = {
        data: {},
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      try {
        await startEmailWatchingFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to start email watching');
      }
    });

    it('should throw HttpsError when createGmailClient fails', async () => {
      const testUid = `${testId}-user-client-fail`;
      const mockRequest = {
        data: { uid: testUid },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      createGmailClientStub.rejects(new Error('Invalid refresh token'));

      try {
        await startEmailWatchingFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to start email watching');
      }
    });

    it('should throw HttpsError when watchGmail fails', async () => {
      const testUid = `${testId}-user-watch-fail`;
      const mockRequest = {
        data: { uid: testUid },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      const mockOAuthClient = { /* mock OAuth2Client */ };
      createGmailClientStub.resolves(mockOAuthClient);
      watchGmailStub.rejects(new Error('Gmail API error'));

      try {
        await startEmailWatchingFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to start email watching');
      }
    });

    it('should throw HttpsError when user is not authenticated', async () => {
      const testUid = `${testId}-user-no-auth`;
      const mockRequest = {
        data: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      try {
        await startEmailWatchingFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to start email watching');
      }
    });
  });
});
