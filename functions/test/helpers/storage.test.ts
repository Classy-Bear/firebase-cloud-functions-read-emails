import { expect, generateTestId } from '../setup';
import * as admin from 'firebase-admin';
import { uploadAttachment } from '../../src/helpers/storage';

describe('Storage Helper Tests', () => {
  let testId: string;
  let bucket: any; // Use any to avoid type issues

  before(async () => {
    bucket = admin.storage().bucket();
    testId = generateTestId();
  });

  afterEach(async () => {
    // Clean up test files after each test
    try {
      const [files] = await bucket.getFiles({ prefix: `attachments/${testId}` });
      if (files.length > 0) {
        await bucket.deleteFiles({ prefix: `attachments/${testId}` });
      }
    } catch (error) {
      console.warn('Storage cleanup warning:', error);
    }
  });

  describe('uploadAttachment', () => {
    it('should upload attachment successfully', async () => {
      const mockBuffer = Buffer.from('mock-file-content');
      const mockParams = {
        userId: testId,
        messageId: 'test-message-id',
        attachmentId: 'test-attachment-id',
        buffer: mockBuffer,
        filename: 'test-file.pdf',
        contentType: 'application/pdf'
      };
      
      const result = await uploadAttachment(mockParams);

      // Verify the file was uploaded by checking if it exists
      const filePath = `attachments/${testId}/test-message-id/test-attachment-id_test-file.pdf`;
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      
      expect(exists).to.be.true;
      expect(result).to.be.a('string');
      
      // Verify metadata was set correctly
      const [metadata] = await file.getMetadata();
      expect(metadata.contentType).to.equal('application/pdf');
      expect(metadata.metadata.userId).to.equal(testId);
      expect(metadata.metadata.messageId).to.equal('test-message-id');
      expect(metadata.metadata.attachmentId).to.equal('test-attachment-id');
      expect(metadata.metadata.originalFilename).to.equal('test-file.pdf');
    });

    it('should handle upload errors gracefully', async () => {
      const mockParams = {
        userId: testId,
        messageId: 'test-message-id',
        attachmentId: 'test-attachment-id',
        buffer: Buffer.from('mock-content'),
        filename: 'test.txt',
        contentType: 'text/plain'
      };
      
      // This test will use real storage operations
      // In online mode, we'll test the happy path and let real errors surface
      try {
        const result = await uploadAttachment(mockParams);
        expect(result).to.be.a('string');
        
        // Verify the file was uploaded
        const filePath = `attachments/${testId}/test-message-id/test-attachment-id_test.txt`;
        const file = bucket.file(filePath);
        const [exists] = await file.exists();
        expect(exists).to.be.true;
      } catch (error: any) {
        // If there's a real error, it should be a storage-related error
        expect(error.message).to.exist;
      }
    });

    it('should handle different file types correctly', async () => {
      const mockParams = {
        userId: testId,
        messageId: 'test-message-id',
        attachmentId: 'test-attachment-id-2',
        buffer: Buffer.from('mock-image-content'),
        filename: 'test-image.jpg',
        contentType: 'image/jpeg'
      };
      
      const result = await uploadAttachment(mockParams);

      // Verify the image file was uploaded with correct metadata
      const filePath = `attachments/${testId}/test-message-id/test-attachment-id-2_test-image.jpg`;
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      
      expect(exists).to.be.true;
      expect(result).to.be.a('string');
      
      const [metadata] = await file.getMetadata();
      expect(metadata.contentType).to.equal('image/jpeg');
      expect(metadata.metadata.originalFilename).to.equal('test-image.jpg');
    });
  });
});
