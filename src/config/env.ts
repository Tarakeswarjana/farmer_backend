import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  REDIS_URL: z.string().optional().default(''),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_REGION: z.string().optional().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  FRONTEND_URL: z.string().min(1).default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

const data = parsed.data;

export const env = {
  port: data.PORT,
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  isDevelopment: data.NODE_ENV === 'development',
  mongoUri: data.MONGODB_URI,
  jwt: {
    accessSecret: data.JWT_ACCESS_SECRET,
    accessExpiresIn: data.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: data.JWT_REFRESH_SECRET,
    refreshExpiresIn: data.JWT_REFRESH_EXPIRES_IN,
  },
  redisUrl: data.REDIS_URL,
  aws: {
    accessKeyId: data.AWS_ACCESS_KEY_ID,
    secretAccessKey: data.AWS_SECRET_ACCESS_KEY,
    region: data.AWS_REGION,
    bucket: data.AWS_S3_BUCKET,
  },
  smtp: {
    host: data.SMTP_HOST,
    port: data.SMTP_PORT,
    user: data.SMTP_USER,
    password: data.SMTP_PASSWORD,
  },
  razorpay: {
    keyId: data.RAZORPAY_KEY_ID,
    keySecret: data.RAZORPAY_KEY_SECRET,
  },
  frontendUrl: data.FRONTEND_URL,
  logLevel: data.LOG_LEVEL,
};

export const s3Configured = Boolean(
  env.aws.accessKeyId && env.aws.secretAccessKey && env.aws.bucket && env.aws.region,
);

export const razorpayConfigured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

export const smtpConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.password);
