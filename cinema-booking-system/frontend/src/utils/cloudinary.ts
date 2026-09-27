export const uploadImageToCloudinary = async (file: File): Promise<string> => {
  const cloudinaryUrl = import.meta.env.VITE_CLOUDINARY_URL || '';
  if (!cloudinaryUrl.startsWith('cloudinary:/')) {
    throw new Error('Invalid or missing VITE_CLOUDINARY_URL environment variable');
  }

  // Parse: cloudinary:/<api_key>:<api_secret>@<cloud_name>
  const match = cloudinaryUrl.match(/cloudinary:\/([^:]+):([^@]+)@(.+)/);
  if (!match) {
    throw new Error('Failed to parse Cloudinary URL');
  }

  const [, apiKey, apiSecret, cloudName] = match;
  const timestamp = Math.round(new Date().getTime() / 1000).toString();

  // Create signature
  const signatureString = `timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to upload image to Cloudinary');
  }

  const result = await response.json();
  return result.secure_url;
};

export const uploadVideoToCloudinary = async (file: File): Promise<string> => {
  const cloudinaryUrl = import.meta.env.VITE_CLOUDINARY_URL || '';
  if (!cloudinaryUrl.startsWith('cloudinary:/')) {
    throw new Error('Invalid or missing VITE_CLOUDINARY_URL environment variable');
  }

  // Parse: cloudinary:/<api_key>:<api_secret>@<cloud_name>
  const match = cloudinaryUrl.match(/cloudinary:\/([^:]+):([^@]+)@(.+)/);
  if (!match) {
    throw new Error('Failed to parse Cloudinary URL');
  }

  const [, apiKey, apiSecret, cloudName] = match;
  const timestamp = Math.round(new Date().getTime() / 1000).toString();

  // Create signature
  const signatureString = `timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to upload video to Cloudinary');
  }

  const result = await response.json();
  return result.secure_url;
};
