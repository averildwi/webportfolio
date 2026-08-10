import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { HashingService } from '../src/common/hashing/hashing.service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const hashingService = new HashingService();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'averildwiy@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const hashedPassword = hashingService.hash(adminPassword);

  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
    },
  });
  console.log(`✅ Admin created/updated with email: ${admin.email}`);

  // 2. Seed Default Site Config
  const existingConfig = await prisma.siteConfig.findFirst();
  
  if (!existingConfig) {
    await prisma.siteConfig.create({
      data: {
        fullName: 'Averil Dwi Yokta Mauladani',
        tagline: 'Fullstack Developer',
        bio: 'I am a backend-focused fullstack developer passionate about building scalable architectures and intuitive user interfaces.',
        availabilityStatus: 'OPEN_TO_WORK',
        socialLinks: {
          github: 'https://github.com/averildwi',
          linkedin: 'https://linkedin.com/in/averildwi',
          email: 'averildwiy@gmail.com',
          instagram: '',
          twitter: ''
        },
      },
    });
    console.log('✅ Default SiteConfig created');
  } else {
    console.log('✅ SiteConfig already exists, skipping...');
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });