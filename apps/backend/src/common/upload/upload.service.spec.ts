import { UploadService } from './upload.service';

describe('UploadService.parseUrl', () => {
  it('mengekstrak public_id image dan membuang ekstensi', () => {
    expect(
      UploadService.parseUrl(
        'https://res.cloudinary.com/demo/image/upload/v1712345678/projects/thumbnails/hero-123abc.webp',
      ),
    ).toEqual({
      publicId: 'projects/thumbnails/hero-123abc',
      resourceType: 'image',
    });
  });

  it('mempertahankan ekstensi untuk resource raw (PDF)', () => {
    // Untuk upload raw, Cloudinary menjadikan ekstensi bagian dari public_id.
    // Kalau ikut dibuang, destroy() tidak akan menemukan file-nya.
    expect(
      UploadService.parseUrl(
        'https://res.cloudinary.com/demo/raw/upload/v1712345678/site-config/resume/cv-123abc.pdf',
      ),
    ).toEqual({
      publicId: 'site-config/resume/cv-123abc.pdf',
      resourceType: 'raw',
    });
  });

  it('menangani public_id tanpa ekstensi', () => {
    expect(
      UploadService.parseUrl(
        'https://res.cloudinary.com/demo/image/upload/v1/folder/file',
      ),
    ).toEqual({ publicId: 'folder/file', resourceType: 'image' });
  });

  it('mengembalikan null untuk URL non-Cloudinary', () => {
    expect(
      UploadService.parseUrl('https://example.com/foo/bar.png'),
    ).toBeNull();
    expect(UploadService.parseUrl('')).toBeNull();
    expect(UploadService.parseUrl('bukan-url')).toBeNull();
  });

  it('mengembalikan null kalau tidak ada path setelah segmen versi', () => {
    expect(
      UploadService.parseUrl('https://res.cloudinary.com/demo/image/upload/v1'),
    ).toBeNull();
  });
});
