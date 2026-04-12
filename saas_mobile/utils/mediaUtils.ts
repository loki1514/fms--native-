import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image to be under ~1MB and limits dimensions to 1200px.
 * Returns the local URI of the compressed image.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Resize width to 1200px (keeps aspect ratio)
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // 70% quality JPEG
    );
    return result.uri;
  } catch (err) {
    console.error('[compressImage] Error:', err);
    return uri; // Fallback to original if compression fails
  }
}

/**
 * Gets a clean filename for storage.
 */
export function getStoragePath(ticketId: string, type: 'before' | 'after', extension: string): string {
  const timestamp = new Date().getTime();
  return `${ticketId}/${type}_${timestamp}.${extension}`;
}
