import { Alert } from 'react-native';

const CLOUD_NAME = 'dhbzqhtr5';
const UPLOAD_PRESET = 'frkquqkj'; 

export const CloudinaryService = {
  uploadImage: async (imageUri: string): Promise<string | null> => {
    const data = new FormData();
    
    // @ts-ignore
    data.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });

    data.append('upload_preset', UPLOAD_PRESET); 
    data.append('cloud_name', CLOUD_NAME);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'post',
        body: data,
      });
      const result = await res.json();

      if (result.error) {
        console.error("Cloudinary Error:", result.error.message);
        Alert.alert("Upload Failed", "Could not upload image.");
        return null;
      }

      // 2. Check Moderation Result
      // If Cloudinary flags it immediately, the status will be 'rejected'
      if (result.moderation && result.moderation.length > 0) {
        const modStatus = result.moderation[0].status;
        
        if (modStatus === 'rejected') {
          Alert.alert("Image Rejected", "This image was detected as inappropriate.");
          return null; 
        }
      }

      // 3. Return Optimized URL
      if (result.secure_url) {
        return result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
      }
      
      return null;
    } catch (e) {
      console.error("Network Error:", e);
      Alert.alert("Error", "Network error during upload.");
      return null;
    }
  }
};