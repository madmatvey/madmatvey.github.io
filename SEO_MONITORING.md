# SEO Monitoring Checklist

## После внедрения Schema.org разметки

### Неделя 1-2: Первичная проверка

- [ ] Проверить конкретный пост в [Rich Results Test](https://search.google.com/test/rich-results)
  - URL примера: `https://madmatvey.github.io/posts/ux-when-initial-app-loading/`
  - Ожидаемые схемы: BlogPosting, BreadcrumbList, Person
  
- [ ] Проверить все схемы в [Schema.org Validator](https://validator.schema.org/)
  - Главная страница: WebSite, Blog, Person ✅
  - Страница поста: BlogPosting, BreadcrumbList, Person
  - Страница About: Person

### Google Search Console - Что проверить

#### 1. Coverage (Покрытие)
- [ ] **Pages → Indexed**: Убедиться, что все посты проиндексированы
- [ ] **Coverage → Excluded**: Проверить ошибки индексации
- [ ] **Coverage → Valid**: Проверить успешно проиндексированные страницы
- [ ] **Coverage → Valid with warnings**: Проверить предупреждения

#### 2. Enhancements (Улучшения)
- [ ] **Rich Results → Articles**: Проверить появление BlogPosting схемы
  - Обычно появляется через 1-2 недели после индексации
  - Проверить количество страниц с rich results
  
- [ ] **Breadcrumbs**: Проверить появление BreadcrumbList схемы
  - Проверить валидность breadcrumbs на всех страницах

#### 3. Performance (Производительность)
- [ ] **Performance → Search results**: Отслеживать изменения CTR
  - Сравнить CTR до и после внедрения Schema.org
  - Ожидаемое улучшение: +10-30% CTR
  
- [ ] **Performance → Discover**: Проверить показы в Discover (если применимо)
- [ ] **Performance → News**: Проверить показы в Google News (если применимо)

#### 4. Core Web Vitals
- [ ] **Core Web Vitals**: Проверить метрики производительности
  - LCP (Largest Contentful Paint) < 2.5s
  - FID (First Input Delay) < 100ms
  - CLS (Cumulative Layout Shift) < 0.1
  - Убедиться, что изменения не ухудшили скорость загрузки

#### 5. Mobile Usability
- [ ] **Mobile Usability**: Проверить мобильную версию
  - Убедиться, что все элементы отображаются корректно
  - Проверить, что Schema.org разметка работает на мобильных

### Неделя 3-4: Мониторинг результатов

- [ ] Проверить появление rich snippets в поисковой выдаче
  - Поиск по запросу: `site:madmatvey.github.io`
  - Проверить наличие расширенных результатов (даты, автора, изображений)
  
- [ ] Отследить изменения в метриках:
  - Количество кликов (Clicks)
  - Показатель отказов (CTR)
  - Средняя позиция в выдаче (Average position)
  
- [ ] Проверить индексацию новых постов
  - Убедиться, что новые посты автоматически получают Schema.org разметку

### Месяц 2-3: Долгосрочный анализ

- [ ] Сравнить показатели за 3 месяца:
  - Общий трафик из поиска
  - CTR по страницам с rich results vs без них
  - Позиции в поисковой выдаче
  
- [ ] Проверить ошибки в Search Console:
  - Coverage errors
  - Rich Results errors (если есть)
  - Mobile Usability issues

### Что делать при проблемах

#### Если Rich Results не появляются:
1. Убедиться, что Schema.org разметка валидна (проверить через Schema.org Validator)
2. Проверить, что страницы проиндексированы
3. Подождать 2-4 недели (Google нужно время на обработку)
4. Использовать URL Inspection Tool для принудительной переиндексации

#### Если есть ошибки в Search Console:
1. Проверить конкретную страницу в Rich Results Test
2. Исправить ошибки в Schema.org разметке
3. Запросить повторную индексацию через URL Inspection Tool

### Полезные ссылки

- [Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [Google Search Console](https://search.google.com/search-console)
- [URL Inspection Tool](https://search.google.com/search-console/inspect)

### Ожидаемые результаты

После внедрения Schema.org разметки ожидается:
- ✅ Улучшение CTR на 10-30%
- ✅ Появление rich snippets в поисковой выдаче
- ✅ Улучшение видимости в поиске
- ✅ Более информативные результаты поиска (даты, авторы, изображения)
