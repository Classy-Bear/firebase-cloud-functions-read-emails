import { expect, sinon } from '../setup';
import * as googleapis from 'googleapis';
import { 
  createGmailClient, 
  exchangeAuthCodeForRefreshToken
} from '../../src/helpers/gmail';
import * as dbHelper from '../../src/helpers/db';

describe('Gmail Helper Tests', () => {
  let googleStub: any;
  let oauth2ClientStub: any;
  let getRefreshTokenStub: sinon.SinonStub;
  let storeRefreshTokenStub: sinon.SinonStub;

  beforeEach(() => {
    sinon.restore();
    
    oauth2ClientStub = {
      setCredentials: sinon.stub(),
      refreshAccessToken: sinon.stub(),
      getToken: sinon.stub()
    };
    
    googleStub = {
      auth: {
        OAuth2: sinon.stub().returns(oauth2ClientStub)
      },
      gmail: sinon.stub()
    };
    
    sinon.stub(googleapis, 'google').value(googleStub);
    getRefreshTokenStub = sinon.stub(dbHelper, 'getRefreshToken');
    storeRefreshTokenStub = sinon.stub(dbHelper, 'storeRefreshToken');
  });

  afterEach(() => {
    // Restore all sinon stubs to prevent them from polluting other tests
    sinon.restore();
  });

  describe('createGmailClient', () => {
    it('should create and return authorized Gmail client', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockAccessToken = 'mock-access-token';
      const mockNewRefreshToken = 'mock-new-refresh-token';
      
      getRefreshTokenStub.resolves(mockRefreshToken);
      oauth2ClientStub.refreshAccessToken.resolves({
        credentials: {
          access_token: mockAccessToken,
          refresh_token: mockNewRefreshToken
        }
      });
      storeRefreshTokenStub.resolves();

      const result = await createGmailClient('test-uid');

      expect(result).to.equal(oauth2ClientStub);
      expect(storeRefreshTokenStub.calledWith('test-uid', mockNewRefreshToken)).to.be.true;
    });

    it('should throw error when refresh token is missing', async () => {
      getRefreshTokenStub.rejects(new Error('No token document found'));

      try {
        await createGmailClient('test-uid');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('No token document found');
      }
    });
  });

  describe('exchangeAuthCodeForRefreshToken', () => {
    it('should exchange auth code for tokens successfully', async () => {
      const mockAuthCode = 'mock-auth-code';
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      
      oauth2ClientStub.getToken.resolves({
        tokens: {
          access_token: mockAccessToken,
          refresh_token: mockRefreshToken
        }
      });

      const result = await exchangeAuthCodeForRefreshToken(mockAuthCode, 'test-uid');

      expect(result).to.deep.equal({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken
      });
    });

    it('should throw error when token exchange fails', async () => {
      oauth2ClientStub.getToken.rejects(new Error('Invalid auth code'));

      try {
        await exchangeAuthCodeForRefreshToken('invalid-code', 'test-uid');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Invalid auth code');
      }
    });

    it('should throw error when tokens are missing', async () => {
      oauth2ClientStub.getToken.resolves({ tokens: {} });

      try {
        await exchangeAuthCodeForRefreshToken('mock-code', 'test-uid');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to obtain access or refresh token');
      }
    });
  });
});
