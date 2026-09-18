import { AuthService } from './auth.service';

describe('AuthService.parseDurationMs', () => {
  it('mengurai unit waktu standar', () => {
    expect(AuthService.parseDurationMs('15m')).toBe(15 * 60 * 1000);
    expect(AuthService.parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(AuthService.parseDurationMs('1h')).toBe(60 * 60 * 1000);
    expect(AuthService.parseDurationMs('500ms')).toBe(500);
    expect(AuthService.parseDurationMs('2w')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  it('menganggap angka tanpa unit sebagai detik (konsisten dengan jsonwebtoken)', () => {
    expect(AuthService.parseDurationMs('3600')).toBe(3600 * 1000);
  });

  it('mentoleransi spasi di sekitar nilai', () => {
    expect(AuthService.parseDurationMs(' 30m ')).toBe(30 * 60 * 1000);
  });

  it('menolak format tidak valid supaya salah konfigurasi terdeteksi saat boot', () => {
    expect(() => AuthService.parseDurationMs('')).toThrow();
    expect(() => AuthService.parseDurationMs('abc')).toThrow();
    expect(() => AuthService.parseDurationMs('15y')).toThrow();
    expect(() => AuthService.parseDurationMs('-5m')).toThrow();
  });
});
