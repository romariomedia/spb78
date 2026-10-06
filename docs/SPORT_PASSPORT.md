# Спортивный ID SportBuddy78

## Назначение

Спортивный ID SportBuddy78 — постоянная цифровая спортивная репутация пользователя внутри проекта. Обычный профиль отвечает за знакомство и общение, а Спортивный ID — за спортивную биографию, подтверждённые результаты и историю участия.

Пользовательское название **«Спортивный паспорт» больше не используется**. В компактных элементах допустима короткая форма **SportBuddy78 ID**.

## Уровни доверия

- **Заявлено** — пользователь сам указал уровень, разряд, опыт или личное достижение.
- **Подтверждено** — зарезервировано для будущей проверки документов или официальных ссылок через Verification Center.
- **Подтверждено SportBuddy78** — запись создана доверенным серверным контуром SportBuddy78.

Пользователь не может самостоятельно присвоить себе статус SportBuddy78.

## Карточка ID

Карточка в профиле показывает:
- фирменный логотип SportBuddy78;
- фото и имя;
- основной вид спорта;
- район;
- уровень/разряд;
- подтверждённые тренировки;
- рейтинг;
- число побед в официальных соревнованиях SportBuddy78.

Медали за ежедневный вход в Спортивный ID не входят.

## Личные достижения

Пользователь может хранить до 30 заявленных достижений. Для каждой записи доступны:
- название;
- вид спорта;
- дата;
- результат / место.

Каждая такая запись остаётся **«Заявлено»**, пока не появится отдельный процесс документальной проверки.

## Официальные соревнования SportBuddy78

В админке, во вкладке «События», для завершённых мероприятий категории «Соревнование» доступен блок фиксации результатов.

Администратор:
1. выбирает завершённое соревнование;
2. выбирает зарегистрированного участника;
3. указывает место / результат;
4. сохраняет запись.

Сервер проверяет:
- мероприятие существует;
- категория — competition;
- статус — finished;
- пользователь был зарегистрирован среди participantIds.

После этого создаётся запись в sportPassportResults со статусом verified и источником sportbuddy. Она автоматически появляется в Спортивном ID как **«Подтверждено SportBuddy78»**.

Результат можно отозвать из админки; действие также логируется.

## Победы и призовые места

В статистике ID:
- **Победы SportBuddy78** — первое место / победитель.
- **Призовые места** — 1, 2 или 3 место.

Они считаются только по официальным sportPassportResults. Игровые медали, streak и ежедневные награды в этот счётчик не входят.

## Публичный ID и QR

Публичность по умолчанию выключена.

Пользователь может включить публичный Спортивный ID. Сервер создаёт случайный publicSlug, не содержащий Firebase UID. Публичная ссылка имеет форму:

`https://sportbuddy78.pro/#/id/<publicSlug>`

Hash-route выбран намеренно: публичная ссылка открывается через существующий nginx/Vite entry point и не требует отдельного rewrite правила.

QR-код ведёт на эту ссылку.

Публичная страница read-only и показывает только:
- имя;
- аватар;
- район;
- основной вид спорта;
- уровень / разряд;
- спортивный стаж;
- число тренировок;
- рейтинг;
- победы и призовые места SportBuddy78;
- официальные результаты;
- заявленные достижения.

Публичный API не выдаёт:
- e-mail;
- телефон;
- дату рождения;
- точные координаты;
- Firebase UID;
- чаты;
- платежи;
- закрытые административные данные.

При выключении публичности та же ссылка перестаёт выдавать ID.

## QR

В текущей версии QR отображается через внешний генератор только из уже публичного URL. В QR не помещаются личные данные — только публичная ссылка. Для полностью автономной инфраструктуры позднее можно заменить визуальный генератор на собственный серверный QR renderer без изменения URL-контракта.

## Фирменный стиль

В ID используется предоставленный логотип SportBuddy78. Оптимизированная копия хранится в:

`public/sportbuddy78-logo.png`

Логотип используется во внутренней карточке, полном ID и публичной версии.

## Дальнейшие этапы

1. Verification Center для документов / официальных ссылок → **Подтверждено**.
2. Расширенные дисциплинарные рекорды по видам спорта.
3. Печатная / PDF-версия ID при необходимости.
4. Собственный QR renderer вместо внешнего визуального сервиса.


## Verification Center

Verification Center implements the middle trust level **«Подтверждено»** for user-provided facts in the SportBuddy78 ID.

### What can be verified
- rank / sport status;
- an individual declared achievement.

Verification is tied to one exact fact, not to the whole profile. The server computes a fingerprint from the current fact. If the athlete changes that rank or achievement later, the verified claim is automatically revoked and the ID returns that fact to **«Заявлено»**.

### Athlete flow
1. Open SportBuddy78 ID.
2. Choose rank/status or one declared achievement.
3. Attach a document/screenshot/PDF through SportBuddy78 media storage and/or provide an official HTTPS link.
4. Add an optional note for the reviewer.
5. Submit the request.

Only one pending request per athlete + fact exists at a time. Already verified facts cannot be submitted again unless their data changes or the verification is revoked.

Evidence files are stored through the existing Cloudinary pipeline. The API rejects arbitrary evidence-file URLs and accepts uploaded evidence only from the configured Cloudinary host. Official reference links may point to external HTTPS sources.

### Admin flow
Control Center contains a dedicated **Верификация** tab:
- pending;
- approved;
- rejected;
- all requests.

The reviewer sees the athlete, exact claim snapshot, evidence, official link and note. The reviewer can approve, reject with a reason, or revoke an existing approval.

Before approval, the server re-reads the athlete's current SportBuddy78 ID and compares the claim fingerprint. A stale request cannot be approved.

### Trust rendering
- **Заявлено** — user-authored fact without an active verified claim.
- **Подтверждено** — active Verification Center claim matching the current fact.
- **Подтверждено SportBuddy78** — official SportBuddy78 competition result generated by the trusted event-result flow.

The public QR version applies the same verification matching rules. Evidence documents, reviewer notes and internal request identifiers are never exposed through the public ID API.

### Audit
Approve, reject and revoke actions are written to adminAuditLogs. Editing a verified fact by the athlete automatically revokes the corresponding claim and marks the source request revoked by the system.
