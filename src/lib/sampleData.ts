/**
 * Единая точка правды для демонстрационных данных.
 *
 * Фейковых атлетов, тренировок, постов и мероприятий не должен видеть ни один
 * реальный пользователь: они допустимы только в локальной разработке и только
 * при явном флаге VITE_ENABLE_SAMPLE_DATA=true в .env.
 *
 * В production-сборке флаг всегда false — даже если переменную зададут на
 * хостинге по ошибке.
 */
export const ENABLE_SAMPLE_DATA: boolean =
  import.meta.env.DEV &&
  !import.meta.env.PROD &&
  import.meta.env.VITE_ENABLE_SAMPLE_DATA === 'true';

/**
 * Служебные профили, которые демо-режим когда-то записал в боевую базу.
 *
 * Реальные аккаунты создаются с id вида vk_* или Firebase-uid, поэтому такие
 * документы можно смело отфильтровывать на чтении: пользователь не увидит
 * выдуманных людей даже до того, как база будет вычищена.
 * Уборка: scripts/cleanup-demo-data.mjs
 */
export const LEGACY_DEMO_USER_IDS: readonly string[] = [
  'user-me-1',
  'user-anna',
  'user-elena',
  'user-maria',
  'user-ekatery',
  'user-daria',
  'user-veronika'
];
