/**
 * Global beta policy for the first 30 days of SportBuddy78.
 *
 * During the public test all functionality is available, but physical/digital
 * SportBuddy BOX prizes are not issued. Set VITE_TEST_PERIOD_ACTIVE=false
 * before the production rewards launch — no code changes required.
 */
export const TEST_PERIOD_DAYS = 30;
export const IS_TEST_PERIOD_ACTIVE =
  import.meta.env.VITE_TEST_PERIOD_ACTIVE !== 'false';

export const TEST_PERIOD_MESSAGE =
  'Сервис полноценно работает, но призовые SportBuddy BOX в тестовый период не выдаются. ' +
  'Пользуйтесь приложением 30 дней и помогите нам найти главные недочёты: ' +
  'ваши тренировки и прогресс будут сохранены.';