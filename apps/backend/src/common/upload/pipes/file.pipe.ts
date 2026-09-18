/// <reference types="multer" />
import { BadRequestException, PipeTransform } from '@nestjs/common';

interface FilePipeOptions {
  maxSizeMb?: number;
  allowedMimes?: string[];
  /** Batas jumlah file untuk upload multi-file. */
  maxFiles?: number;
  /** Kalau false, request tanpa file dibiarkan lolos (field opsional). */
  required?: boolean;
}

const DEFAULT_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validasi ukuran dan tipe file upload.
 *
 * Menangani `@UploadedFile()` (satu file) maupun `@UploadedFiles()` (array).
 * Bentuk array wajib ditangani eksplisit: kalau array diperlakukan sebagai satu
 * objek file, `size` dan `mimetype` bernilai undefined sehingga cek ukuran
 * terlewat sepenuhnya dan cek MIME selalu gagal — endpoint multi-file jadi
 * tidak mungkin berhasil sekaligus tidak tervalidasi.
 */
export class FilePipe implements PipeTransform<
  Express.Multer.File | Express.Multer.File[]
> {
  constructor(private readonly options: FilePipeOptions = {}) {}

  transform(
    input: Express.Multer.File | Express.Multer.File[],
  ): Express.Multer.File | Express.Multer.File[] {
    const { required = true, maxFiles } = this.options;

    if (Array.isArray(input)) {
      if (input.length === 0) {
        if (required) throw new BadRequestException('File is required');
        return input;
      }

      if (maxFiles !== undefined && input.length > maxFiles) {
        throw new BadRequestException(
          `Maksimal ${maxFiles} file per upload. Dikirim: ${input.length}.`,
        );
      }

      input.forEach((file, index) => this.validate(file, index));
      return input;
    }

    if (!input) {
      if (required) throw new BadRequestException('File is required');
      return input;
    }

    this.validate(input);
    return input;
  }

  private validate(file: Express.Multer.File, index?: number): void {
    const { maxSizeMb = 5, allowedMimes = DEFAULT_ALLOWED_MIMES } =
      this.options;

    // Sebutkan file mana yang bermasalah saat upload multi-file, supaya admin
    // tidak harus menebak di antara sepuluh file.
    const label =
      file?.originalname ??
      (index !== undefined ? `file ke-${index + 1}` : 'file');

    if (!file) {
      throw new BadRequestException(`${label} tidak valid`);
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      const actualMb = (file.size / 1024 / 1024).toFixed(2);
      throw new BadRequestException(
        `${label}: ukuran melebihi batas ${maxSizeMb}MB (file ini ${actualMb}MB)`,
      );
    }

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${label}: tipe "${file.mimetype}" tidak diizinkan. Yang diizinkan: ${allowedMimes.join(', ')}`,
      );
    }
  }
}
