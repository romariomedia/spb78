export const DATA_PLATFORM_MODES=Object.freeze(['legacy','shadow','russian_primary']);
export const MEDIA_STORAGE_MODES=Object.freeze(['cloudinary','russian_s3']);

const bool=value=>String(value||'').toLowerCase()==='true';
const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export function getDataPlatformConfig(env=process.env){
  const requestedDataMode=clean(env.SB_DATA_PLATFORM_MODE,40)||'legacy';
  const requestedMediaMode=clean(env.SB_MEDIA_STORAGE_MODE,40)||'cloudinary';

  const dataMode=DATA_PLATFORM_MODES.includes(requestedDataMode)?requestedDataMode:'legacy';
  const mediaMode=MEDIA_STORAGE_MODES.includes(requestedMediaMode)?requestedMediaMode:'cloudinary';

  const postgresConfigured=Boolean(
    clean(env.SB_POSTGRES_URL,1000)
    || (
      clean(env.SB_POSTGRES_HOST,300)
      && clean(env.SB_POSTGRES_DB,120)
      && clean(env.SB_POSTGRES_USER,120)
    )
  );
  const russianS3Configured=Boolean(
    clean(env.SB_S3_ENDPOINT,500)
    && clean(env.SB_S3_BUCKET,180)
    && clean(env.SB_S3_ACCESS_KEY_ID,300)
    && clean(env.SB_S3_SECRET_ACCESS_KEY,500)
  );

  const shadowEnabled=dataMode==='shadow'
    && bool(env.SB_DATA_SHADOW_WRITES_ENABLED)
    && postgresConfigured;

  const russianPrimaryEnabled=dataMode==='russian_primary'
    && bool(env.SB_DATA_RUSSIAN_PRIMARY_ENABLED)
    && postgresConfigured;

  const russianMediaEnabled=mediaMode==='russian_s3'
    && bool(env.SB_MEDIA_RUSSIAN_PRIMARY_ENABLED)
    && russianS3Configured;

  return Object.freeze({
    dataMode,
    mediaMode,
    postgresConfigured,
    russianS3Configured,
    shadowEnabled,
    russianPrimaryEnabled,
    russianMediaEnabled,
    legacyFirestoreActive:!russianPrimaryEnabled,
    legacyCloudinaryActive:!russianMediaEnabled
  });
}

export function assertSafeDataPlatformConfig(env=process.env){
  const config=getDataPlatformConfig(env);
  if(config.dataMode==='shadow'&&!config.shadowEnabled){
    throw new Error('SB_DATA_PLATFORM_MODE=shadow requires PostgreSQL config and SB_DATA_SHADOW_WRITES_ENABLED=true');
  }
  if(config.dataMode==='russian_primary'&&!config.russianPrimaryEnabled){
    throw new Error('SB_DATA_PLATFORM_MODE=russian_primary requires PostgreSQL config and SB_DATA_RUSSIAN_PRIMARY_ENABLED=true');
  }
  if(config.mediaMode==='russian_s3'&&!config.russianMediaEnabled){
    throw new Error('SB_MEDIA_STORAGE_MODE=russian_s3 requires S3 config and SB_MEDIA_RUSSIAN_PRIMARY_ENABLED=true');
  }
  return config;
}

export function publicDataPlatformStatus(env=process.env){
  const c=getDataPlatformConfig(env);
  return {
    dataMode:c.dataMode,
    mediaMode:c.mediaMode,
    postgresConfigured:c.postgresConfigured,
    russianS3Configured:c.russianS3Configured,
    shadowEnabled:c.shadowEnabled,
    russianPrimaryEnabled:c.russianPrimaryEnabled,
    russianMediaEnabled:c.russianMediaEnabled
  };
}
