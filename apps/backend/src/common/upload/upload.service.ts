/// <reference types="multer" />
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as path from 'path';
import * as crypto from 'crypto';

export type UploadKind = 'image' | 'document';

export interface UploadResult {
  url: string;
  publicId: string;
  resourceType: string;
}

@Injectable()
export class UploadService {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    kind: UploadKind = 'image',
  ): Promise<UploadResult> {
    const isImage = kind === 'image';

    const ext = path.extname(file.originalname);
    const rawName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_');
    const cleanName = rawName.length > 0 ? rawName : 'file';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const customPublicId = `${cleanName}-${uniqueSuffix}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isImage ? 'image' : 'raw',
          ...(!isImage && { public_id: `${customPublicId}${ext}` }),
          ...(isImage && {
            transformation: [
              { width: 1080, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          }),
        },
        (error, res) => {
          if (error || !res) {
            return reject(
              error instanceof Error
                ? error
                : new BadRequestException('Upload ke Cloudinary gagal'),
            );
          }
          resolve(res);
        },
      );

      Readable.from(file.buffer).pipe(upload);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
    };
  }

  async deleteFile(
    publicId: string,
    resourceType: string = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }

  /**
   * Hapus file berdasarkan URL Cloudinary. Aman dipanggil untuk URL apa pun —
   * kalau URL tidak dikenali atau penghapusan gagal, error ditelan (best-effort
   * cleanup, tidak boleh menggagalkan operasi bisnis utama).
   */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;

    const info = UploadService.parseUrl(url);
    if (!info) return;

    await this.deleteFile(info.publicId, info.resourceType).catch(() => {});
  }

  /**
   * Ekstrak public_id + resource_type dari URL Cloudinary.
   * Untuk upload `raw` (PDF) public_id menyertakan ekstensi file, jadi harus
   * dipertahankan; untuk image, suffix format dibuang.
   */
  static parseUrl(
    url: string,
  ): { publicId: string; resourceType: string } | null {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex((part) => part === 'upload');
      if (uploadIndex === -1) return null;

      const resourceType =
        urlParts[uploadIndex - 1] === 'raw' ? 'raw' : 'image';

      // Lewati segmen versi (v123456) setelah "upload"
      const pathParts = urlParts.slice(uploadIndex + 2);
      let publicId = pathParts.join('/');
      if (!publicId) return null;

      if (resourceType === 'image') {
        const dotIndex = publicId.lastIndexOf('.');
        if (dotIndex !== -1) {
          publicId = publicId.substring(0, dotIndex);
        }
      }

      return { publicId, resourceType };
    } catch {
      return null;
    }
  }
}
