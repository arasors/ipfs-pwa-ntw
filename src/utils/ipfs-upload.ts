import { addBytes } from './ipfs';

export const uploadToIPFS = async (file: File): Promise<{ cid: string, mimeType: string }> => {
  try {
    // Convert file to bytes
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    
    // Upload to IPFS with progress tracking
    const cid = await addBytes(fileBytes, {
      filename: file.name,
      mimeType: file.type,
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress * 100}%`);
      },
      pin: true
    });
    
    if (!cid) {
      throw new Error('Failed to get CID from upload');
    }
    
    console.log('File uploaded to IPFS with CID:', cid);
    
    return {
      cid,
      mimeType: file.type
    };
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    throw new Error('Failed to upload file to IPFS');
  }
}; 