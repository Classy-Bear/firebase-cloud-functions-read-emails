import { expect } from '../setup';
import * as functionsv2 from 'firebase-functions/v2';
import { getCredentials } from '../../src/utils/httpv2';

describe('httpv2 Helper Tests', () => {
  it('should return uid when user is authenticated', async () => {
    const mockRequest = {
      auth: { uid: 'test-uid' }
    } as functionsv2.https.CallableRequest;

    const result = await getCredentials(mockRequest);
    
    expect(result).to.equal('test-uid');
  });

  it('should throw error when uid is missing', async () => {
    const mockRequest = {
      auth: {}
    } as functionsv2.https.CallableRequest;

    try {
      await getCredentials(mockRequest);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.include('User must be authenticated');
    }
  });
});
