import { expect, sinon, cleanupTestData, generateTestId } from '../setup';
import * as functionsv2 from 'firebase-functions/v2';
import { storeRefreshTokenFunction } from '../../src/functions/storeRefreshToken';
import * as gmailHelper from '../../src/helpers/gmail';
import * as dbHelper from '../../src/helpers/db';
import * as httpv2Helper from '../../src/utils/httpv2';

describe('storeRefreshTokenFunction', () => {
  let testId: string;
  let exchangeAuthCodeStub: sinon.SinonStub;
  let storeRefreshTokenStub: sinon.SinonStub;
  let getCredentialsStub: sinon.SinonStub;

  before(async () => {
    testId = generateTestId();
  });

  beforeEach(() => {
    sinon.restore();
    
    exchangeAuthCodeStub = sinon.stub(gmailHelper, 'exchangeAuthCodeForRefreshToken');
    storeRefreshTokenStub = sinon.stub(dbHelper, 'storeRefreshToken');
    getCredentialsStub = sinon.stub(httpv2Helper, 'getCredentials');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData('gmail_tokens', testId);
    // Restore all sinon stubs to prevent them from polluting other tests
    sinon.restore();
  });

  describe('successful token storage', () => {
    it('should store refresh token successfully with valid auth code', async () => {
      const testUid = `${testId}-user`;
      const mockRequest = {
        data: { authCode: 'valid-auth-code' },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      getCredentialsStub.resolves(testUid);
      exchangeAuthCodeStub.resolves({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token'
      });
      storeRefreshTokenStub.resolves();

      await storeRefreshTokenFunction(mockRequest);

      expect(getCredentialsStub.calledWith(mockRequest)).to.be.true;
      expect(exchangeAuthCodeStub.calledWith('valid-auth-code', testUid)).to.be.true;
      expect(storeRefreshTokenStub.calledWith(testUid, 'mock-refresh-token')).to.be.true;
    });
  });

  describe('error handling', () => {
    it('should throw HttpsError when authentication fails', async () => {
      const mockRequest = {
        data: { authCode: 'valid-auth-code' }
      } as functionsv2.https.CallableRequest;

      getCredentialsStub.rejects(new Error('User must be authenticated'));

      try {
        await storeRefreshTokenFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to store refresh token');
      }
    });

    it('should throw HttpsError when auth code exchange fails', async () => {
      const testUid = `${testId}-user-exchange-fail`;
      const mockRequest = {
        data: { authCode: 'invalid-auth-code' },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      getCredentialsStub.resolves(testUid);
      exchangeAuthCodeStub.rejects(new Error('Invalid authorization code'));

      try {
        await storeRefreshTokenFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to store refresh token');
      }
    });

    it('should throw HttpsError when database storage fails', async () => {
      const testUid = `${testId}-user-db-fail`;
      const mockRequest = {
        data: { authCode: 'valid-auth-code' },
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      getCredentialsStub.resolves(testUid);
      exchangeAuthCodeStub.resolves({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token'
      });
      storeRefreshTokenStub.rejects(new Error('Database error'));

      try {
        await storeRefreshTokenFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to store refresh token');
      }
    });

    it('should throw HttpsError when auth code is missing', async () => {
      const testUid = `${testId}-user-no-code`;
      const mockRequest = {
        data: {},
        auth: { uid: testUid }
      } as functionsv2.https.CallableRequest;

      getCredentialsStub.resolves(testUid);

      try {
        await storeRefreshTokenFunction(mockRequest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to store refresh token');
      }
    });
  });
});
