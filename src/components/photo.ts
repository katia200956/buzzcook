import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// One photo from the camera or the gallery, shrunk to 1600 px wide and returned as JPEG base64
// (small enough to send, sharp enough to read a receipt). Null when cancelled or not allowed.
export async function pickPhoto(from: 'camera' | 'library'): Promise<string | null> {
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1600) ctx.resize({ width: 1600 });
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.75 });
  return img.base64 ?? null;
}
