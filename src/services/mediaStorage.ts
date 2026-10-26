import {
  avatarUrl as cloudinaryAvatarUrl,
  photoUrl as cloudinaryPhotoUrl,
  uploadMedia as uploadCloudinaryMedia,
  uploadRemoteUrl as uploadCloudinaryRemoteUrl,
  uploadToCloudinary,
  videoPoster as cloudinaryVideoPoster,
  type CloudinaryUploadResult,
  type UploadOptions
} from './cloudinary';

export type MediaStorageProvider='cloudinary'|'russian_s3';
export type MediaUploadResult=CloudinaryUploadResult;

/**
 * Neutral client media boundary.
 *
 * Production still uses Cloudinary. New code should import media operations
 * from this file instead of binding directly to a provider. When Russian S3
 * is introduced, provider-specific logic can move behind this API without
 * rewriting every feature.
 */
export const CURRENT_MEDIA_STORAGE_PROVIDER:MediaStorageProvider='cloudinary';

export const uploadMediaAsset=(file:File,options:UploadOptions={})=>
  uploadCloudinaryMedia(file,options);

export const uploadMediaUrl=(file:File,options:UploadOptions={})=>
  uploadToCloudinary(file,options);

export const importRemoteMediaUrl=(url:string,options:UploadOptions={})=>
  uploadCloudinaryRemoteUrl(url,options);

export const avatarMediaUrl=(url?:string|null,size=96)=>
  cloudinaryAvatarUrl(url,size);

export const photoMediaUrl=(url?:string|null,width=800)=>
  cloudinaryPhotoUrl(url,width);

export const videoMediaPoster=(url?:string|null,width=720)=>
  cloudinaryVideoPoster(url,width);
