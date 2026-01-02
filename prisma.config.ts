// File: prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  datasource: {
    // GANTI 'process.env.DATABASE_URL' DENGAN LINK ASLI ANDA
    // Pastikan pakai tanda kutip, dan password 'Jason2003'
    url: "postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public", 
  },
});