# Portfo

Авторский сайт Аси Мельниковой: из задачи — в работающий цифровой продукт.

Воронка: проблема → как думаю → решение → попробовать → Люся → маршрут → заявка.

## Карусели

- [Ши Чэн](https://asyamendesz-jpg.github.io/carousel-Atlantis-/)
- [Алхимик](https://asyamendesz-jpg.github.io/The-Alchemist-Carousel/)

## Маршруты проектов

- [Портал «Внеклассное чтение»](https://asyamendes.ru/) — книжные экспедиции, маршрут читателя, аудио и PDF-испытания
- [Шёлковый путь](https://asyamendesz-jpg.github.io/The-Silk-Road/)
- [Подводная Атлантида Китая](https://asyamendesz-jpg.github.io/Atlantis-China/)
- [Какой вы алхимик?](https://asyamendesz-jpg.github.io/The-Alchemist-Quiz/)
- [Высотки-Юг](https://friendly-encounter-sun.lovable.app)
- [FORMA — визитка магазина обуви](https://asyamendesz-jpg.github.io/shoe-store-s-business-card-website/)
- [Что изменилось на острове?](https://ostrov.ai.studio)
- [Собери картинку](https://asyamendesz-jpg.github.io/---/docs/) — детская картинка-игра / пазл
- [Кем быть для достижения успеха?](https://mojo-career.lovable.app)

## Навигатор Люся

Люся — digital-навигатор: помогает сформулировать задачу перед разговором с Асей. Редкие встречи по сайту и карта проекта в `#lyusya-quest`.

- Тексты: `lyusya/lyusya-data.js`
- Игра: `lyusya/lyusya-game.js`
- Сопровождение: `lyusya/lyusya-companion.js`
- Стили: `lyusya/lyusya.css`, `lyusya/lyusya-companion.css`
- Образы: `images/lyusya/`

События Люси: `window.__lyusyaEvents` и `lyusya:event`. События сайта: `window.__portfoEvents` и `portfo:event`. Память: `localStorage` / `sessionStorage`.

## Площадки

- [aniuka.ru](https://aniuka.ru/)
- [Sostav · Финт](https://www.sostav.ru/blogs/287973)
- [Дзен](https://dzen.ru/proshl)
- [ВКонтакте](https://vk.ru/melnikovaasiy)

## Запуск

Дважды кликните `index.html` или `open-site.bat`. Скрипты подключаются через `defer`, без сборщика. Для проверки якорей, фильтров и `file://` ограничений удобен локальный сервер:

```bash
npx --yes serve .
```

Документация: [instruction.html](instruction.html)

## Фильтры портфолио

Кнопки в `#expeditions` пишут `?category=` в URL (`sites`, `quizzes`, `games`, `products`). Ссылка с услуги выглядит как `?category=sites#expeditions`. Без JavaScript видны все 10 работ. С фильтром скрытые карточки получают `display: none` и `inert`; прямая ссылка `#case-...` показывает карточку даже вне текущей категории. Счётчик и сброс («Все работы») живут в `script.js`.

## Контекст формы

Услуга (`data-service` / `data-service-label`), проект (`data-project` / `data-project-label`) и маршрут Люси хранятся отдельно от поля `#project`. Свободный текст в поле не затирается. Перед отправкой они собираются в тело письма / JSON. Контакты и полный текст обращения в `localStorage` не пишутся. Память Люси (`lyusyaCompanion`) — только прогресс сопровождения.

## Отправка заявки

Публичная конфигурация: `form-config.js` (`contactEmail`, `apiUrl`). Пока `apiUrl` пустой, на сайте остаётся запасной `mailto:` — это не серверная отправка.

Рабочий путь — PHP на хостинге Beget Start, сайт `forms.asyamendes.ru`, каталог рядом с `public_html`. Фронтенд остаётся на GitHub Pages. Контракт тот же: POST JSON, успех — HTTP 2xx и `{ ok: true }`. Получатель только из серверного `config.php` (`asya.mendes.z@gmail.com`), не из тела запроса. Ошибка API не открывает почтовую программу.

Файлы: `forms-beget/`. Пошаговая загрузка: `forms-beget/INSTALL.txt`.

По документации Beget PHP выполняется как модуль Apache в `public_html`. Node.js на виртуальном хостинге доступен только через Docker и Apache Passenger — для этой формы не используется. `api/contact.js` оставлен как прежний Vercel-вариант, в работу его не включать.

### Что сделать владельцу, чтобы заявки уходили с сайта

Пароли вводить только в `forms.asyamendes.ru/config.php` на сервере, не в чат и не в Git. Gmail — получатель, не SMTP-логин Beget.

1. В панели Beget создать новый почтовый ящик на `asyamendes.ru` для отправки (например `forms@asyamendes.ru`). Не использовать `hello@asyamendes.ru` и `work@asyamendes.ru`.
2. SMTP по документации Beget: `smtp.beget.com`, порт `465` (SSL). Логин и пароль — этого ящика.
3. Дождаться Wildcard SSL и открытия `https://forms.asyamendes.ru/contact.php`.
4. Загрузить файлы по `forms-beget/INSTALL.txt` (конфиг и библиотека выше `public_html`).
5. Проверить обработчик без публикации главной. Только после успеха вписать в `form-config.js`: `apiUrl: "https://forms.asyamendes.ru/contact.php"`.

Локальная проверка правил: `node forms-beget/test/run.js` (без SMTP). При наличии PHP CLI: `php forms-beget/test/run.php`.

## Как добавить работу в портфолио

Источник карточек — статический HTML в `index.html`, секция `#expeditions`. Генератор сайта и CMS не используются.

1. Скопируйте ближайшую карточку `<article class="expedition expedition--proof">`.
2. Задайте уникальный `id="case-..."`. Не повторяйте существующие якоря.
3. Укажите `data-categories` через пробел из списка: `sites`, `quizzes`, `games`, `products`. Работа может входить в несколько категорий.
4. Заполните название, краткую задачу, роль и статус только подтверждёнными формулировками из материалов проекта.
5. Перед публикацией проверьте согласие клиента, если работу нельзя показывать как внедрение. Не усиливайте статус.
6. Обложку задайте тегом `<img class="expedition-media">` либо существующим классом тона (`expedition-media--portal` и т.д.). Новый CSS нужен только для особой обложки.
7. Сохраните все демо-ссылки. Если демо несколько, добавьте отдельную ссылку на каждое.
8. Проверьте: все работы без JavaScript; `?category=sites#expeditions`; прямую ссылку `#case-...`; кнопку «Обсудить похожий».
