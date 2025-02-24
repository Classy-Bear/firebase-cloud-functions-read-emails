import { logger } from "firebase-functions/v2";
import { getStorage } from "firebase-admin/storage";
import { getDownloadURL } from "firebase-admin/storage";

/**
 * Parameters for uploading an attachment to Firebase Storage
 * @property {string} userId - The user ID who owns the attachment
 * @property {string} messageId - The email message ID
 * @property {string} attachmentId - The attachment ID from Gmail
 * @property {Buffer} buffer - The attachment data
 * @property {string} filename - The original filename of the attachment
 * @property {string} contentType - The content type of the attachment
 */
type UploadAttachmentParams = {
  userId: string;
  messageId: string;
  attachmentId: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
};

/**
 * Uploads an attachment to Firebase Storage
 * @param {UploadAttachmentParams} params - The parameters for the upload
 * @returns {Promise<string>} The download URL of the uploaded file
 */
export const uploadAttachment = async (params: UploadAttachmentParams): Promise<string> => {
  const { userId, messageId, attachmentId, buffer, filename, contentType } = params;
  try {
    // Create a unique path for the attachment
    const filePath = `attachments/${userId}/${messageId}/${attachmentId}_${filename}`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          userId,
          messageId,
          attachmentId,
          originalFilename: filename
        }
      }
    });
    const url = await getDownloadURL(file);
    logger.info('Attachment uploaded successfully', { params, url });
    return url;
  } catch (error) {
    logger.error('Error uploading attachment', { error, params });
    throw error;
  }
}; 
