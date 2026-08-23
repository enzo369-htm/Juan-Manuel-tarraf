import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { hasR2, optionalEnv, requireEnv } from './env'

export function r2Client() {
  if (!hasR2()) throw new Error('Faltan variables de R2')
  const accountId = requireEnv('R2_ACCOUNT_ID')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  const client = r2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  const base = optionalEnv('R2_PUBLIC_BASE_URL').replace(/\/$/, '')
  if (base) return `${base}/${key}`
  return `https://${requireEnv('R2_BUCKET')}.${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${key}`
}
