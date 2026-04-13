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
 * Gets a clean, consistent path for storage.
 * Uses a FIXED filename per slot so replacements overwrite the old file directly.
 * The extension must match the ACTUAL file type being stored.
 */
export function getStoragePath(
  ticketId: string,
  type: 'before' | 'after',
  extension: 'jpg' | 'mp4'
): string {
  return `${ticketId}/${type}.${extension}`;
}

/**
 * Gets the storage path for a specific media type (photo or video) for a slot.
 * Used to find and delete the old file before uploading a replacement.
 */
export function getStoragePathForSlot(
  ticketId: string,
  type: 'before' | 'after',
  isPhoto: boolean
): string {
  return `${ticketId}/${type}.${isPhoto ? 'jpg' : 'mp4'}`;
}
