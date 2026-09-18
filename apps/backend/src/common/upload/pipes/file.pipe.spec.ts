import { BadRequestException } from '@nestjs/common';
import { FilePipe } from './file.pipe';

const file = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'foto.png',
    mimetype: 'image/png',
    size: 1024,
    ...overrides,
  }) as Express.Multer.File;

describe('FilePipe — satu file', () => {
  it('meloloskan file yang valid', () => {
    const pipe = new FilePipe({ maxSizeMb: 2 });
    const input = file();
    expect(pipe.transform(input)).toBe(input);
  });

  it('menolak file yang melebihi batas ukuran', () => {
    const pipe = new FilePipe({ maxSizeMb: 1 });
    expect(() => pipe.transform(file({ size: 2 * 1024 * 1024 }))).toThrow(
      BadRequestException,
    );
  });

  it('menolak MIME di luar allowlist', () => {
    const pipe = new FilePipe({ allowedMimes: ['image/png'] });
    expect(() => pipe.transform(file({ mimetype: 'application/pdf' }))).toThrow(
      /tidak diizinkan/,
    );
  });

  it('menolak request tanpa file', () => {
    const pipe = new FilePipe();
    expect(() =>
      pipe.transform(undefined as unknown as Express.Multer.File),
    ).toThrow('File is required');
  });

  it('membiarkan file kosong lolos bila required=false', () => {
    const pipe = new FilePipe({ required: false });
    expect(() =>
      pipe.transform(undefined as unknown as Express.Multer.File),
    ).not.toThrow();
  });
});

describe('FilePipe — array (@UploadedFiles)', () => {
  // Regresi: sebelumnya array diperlakukan sebagai satu objek file, sehingga
  // `size`/`mimetype` undefined. Efeknya cek ukuran terlewat dan cek MIME
  // selalu gagal, membuat POST /projects/:id/docs tidak pernah bisa berhasil.
  it('meloloskan array yang semuanya valid', () => {
    const pipe = new FilePipe({
      maxSizeMb: 5,
      allowedMimes: ['image/png', 'application/pdf'],
    });
    const input = [
      file(),
      file({ originalname: 'doc.pdf', mimetype: 'application/pdf' }),
    ];

    expect(pipe.transform(input)).toBe(input);
  });

  it('mendeteksi satu file oversize di tengah array', () => {
    const pipe = new FilePipe({ maxSizeMb: 1 });
    const input = [
      file(),
      file({ originalname: 'besar.png', size: 5 * 1024 * 1024 }),
      file(),
    ];

    expect(() => pipe.transform(input)).toThrow(/besar\.png/);
    expect(() => pipe.transform(input)).toThrow(/melebihi batas 1MB/);
  });

  it('mendeteksi satu file dengan MIME terlarang di dalam array', () => {
    const pipe = new FilePipe({ allowedMimes: ['image/png'] });
    const input = [
      file(),
      file({ originalname: 'jahat.exe', mimetype: 'application/x-msdownload' }),
    ];

    expect(() => pipe.transform(input)).toThrow(/jahat\.exe/);
  });

  it('menyebut allowlist yang dikonfigurasi, bukan default', () => {
    // Bug lama melaporkan allowlist default (jpeg/png/webp) walau opsi
    // menetapkan yang lain — pesan error jadi menyesatkan.
    const pipe = new FilePipe({ allowedMimes: ['application/pdf'] });
    const input = [file({ mimetype: 'image/gif' })];

    expect(() => pipe.transform(input)).toThrow(/application\/pdf/);
    expect(() => pipe.transform(input)).not.toThrow(/image\/webp/);
  });

  it('menolak array kosong', () => {
    const pipe = new FilePipe();
    expect(() => pipe.transform([])).toThrow('File is required');
  });

  it('menegakkan batas jumlah file', () => {
    const pipe = new FilePipe({ maxFiles: 2 });
    const input = [file(), file(), file()];

    expect(() => pipe.transform(input)).toThrow(/Maksimal 2 file/);
  });

  it('memakai batas ukuran per file, bukan total', () => {
    // Tiga file @0.5MB tidak boleh dianggap melebihi batas 1MB.
    const pipe = new FilePipe({ maxSizeMb: 1 });
    const half = 512 * 1024;
    const input = [
      file({ size: half }),
      file({ size: half }),
      file({ size: half }),
    ];

    expect(() => pipe.transform(input)).not.toThrow();
  });
});
