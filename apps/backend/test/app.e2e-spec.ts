import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createValidationPipe } from './../src/common/pipes/validation.pipe.config';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';

/**
 * Smoke test kontrak HTTP publik. Butuh DATABASE_URL yang bisa dijangkau.
 */
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter(),
      new PrismaExceptionFilter(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health mengembalikan status', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect([200, 503]).toContain(res.status);
  });

  it('GET /api/projects membungkus respons dengan envelope + meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .expect(200);

    const body = res.body as {
      statusCode: number;
      message: string;
      data: unknown;
      meta: Record<string, unknown>;
    };

    expect(body.statusCode).toBe(200);
    expect(body.message).toBe('Success');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('GET /api/projects menolak limit di luar batas', async () => {
    await request(app.getHttpServer())
      .get('/api/projects?limit=9999')
      .expect(400);
  });

  it('GET /api/projects menolak page tidak valid', async () => {
    await request(app.getHttpServer()).get('/api/projects?page=0').expect(400);
    await request(app.getHttpServer()).get('/api/projects?page=-1').expect(400);
  });

  it('GET /api/projects menolak query param yang tidak dikenal', async () => {
    // forbidNonWhitelisted mencegah filter siluman seperti ?status=DRAFT
    await request(app.getHttpServer())
      .get('/api/projects?status=DRAFT')
      .expect(400);
  });

  it('POST /api/auth/login menolak kredensial salah tanpa membocorkan info', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'tidak-ada@example.com', password: 'salah-sekali' })
      .expect(401);

    // Pesan harus identik untuk email tidak ada maupun password salah,
    // supaya tidak bisa dipakai untuk enumerasi akun.
    const body = res.body as { message: string };
    expect(body.message).toBe('Email atau password salah');
  });

  it('POST /api/auth/refresh tanpa cookie mengembalikan 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('endpoint admin menolak request tanpa token', async () => {
    await request(app.getHttpServer()).get('/api/projects/admin').expect(401);
    await request(app.getHttpServer()).get('/api/contact').expect(401);
    await request(app.getHttpServer()).get('/api/guestbook/admin').expect(401);
  });
});
