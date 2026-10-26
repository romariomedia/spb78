import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeDataPlatformConfig,getDataPlatformConfig,publicDataPlatformStatus
} from '../server/data-platform.js';

test('data platform defaults keep current production architecture',()=>{
  const config=getDataPlatformConfig({});
  assert.equal(config.dataMode,'legacy');
  assert.equal(config.mediaMode,'cloudinary');
  assert.equal(config.legacyFirestoreActive,true);
  assert.equal(config.legacyCloudinaryActive,true);
  assert.equal(config.shadowEnabled,false);
  assert.equal(config.russianPrimaryEnabled,false);
  assert.equal(config.russianMediaEnabled,false);
});

test('dangerous future modes fail closed without explicit enable flags',()=>{
  assert.throws(
    ()=>assertSafeDataPlatformConfig({
      SB_DATA_PLATFORM_MODE:'russian_primary',
      SB_POSTGRES_URL:'postgres://configured-but-not-enabled'
    }),
    /SB_DATA_RUSSIAN_PRIMARY_ENABLED=true/
  );
  assert.throws(
    ()=>assertSafeDataPlatformConfig({
      SB_MEDIA_STORAGE_MODE:'russian_s3',
      SB_S3_ENDPOINT:'https://s3.example.ru',
      SB_S3_BUCKET:'sportbuddy',
      SB_S3_ACCESS_KEY_ID:'key',
      SB_S3_SECRET_ACCESS_KEY:'secret'
    }),
    /SB_MEDIA_RUSSIAN_PRIMARY_ENABLED=true/
  );
});

test('shadow mode requires both database configuration and explicit enable flag',()=>{
  const disabled=getDataPlatformConfig({
    SB_DATA_PLATFORM_MODE:'shadow',
    SB_DATA_SHADOW_WRITES_ENABLED:'true'
  });
  assert.equal(disabled.shadowEnabled,false);

  const enabled=assertSafeDataPlatformConfig({
    SB_DATA_PLATFORM_MODE:'shadow',
    SB_DATA_SHADOW_WRITES_ENABLED:'true',
    SB_POSTGRES_URL:'postgres://future-russian-db'
  });
  assert.equal(enabled.shadowEnabled,true);
  assert.equal(enabled.legacyFirestoreActive,true);
});

test('public data platform status never exposes connection credentials',()=>{
  const status=publicDataPlatformStatus({
    SB_DATA_PLATFORM_MODE:'legacy',
    SB_POSTGRES_URL:'postgres://user:password@host/db',
    SB_S3_SECRET_ACCESS_KEY:'top-secret'
  });
  assert.equal(JSON.stringify(status).includes('password'),false);
  assert.equal(JSON.stringify(status).includes('top-secret'),false);
});
