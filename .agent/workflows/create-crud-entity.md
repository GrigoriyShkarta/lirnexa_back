---
description: Создаёт полный CRUD-модуль для новой сущности: Prisma модель + миграция + DTO + сервис + контроллер + swagger-документация + обновление модуля.
---

# /create-crud-entity

**Usage examples:**
- /create-crud-entity user
- /create-crud-entity product name:string unique price:decimal stock:int created_at:DateTime

**Instructions / Steps for Agent:**

1. Если название сущности не передано — спроси у пользователя.
2. Спроси поля сущности в формате: field_name:type [unique/default/...], например:
   - id: number @id @default(autoincrement())
   - email: string unique
   - name: string
   - created_at: DateTime @default(now())
   - updated_at: DateTime @updatedAt

3. Сгенерируй блок модели в `prisma/schema.prisma`:
   - Модель: PascalCase singular (User, Product)
   - Поля: camelCase в Prisma, но с @map("snake_case") для БД
   - Добавь @@map("users") / @@map("products") для таблицы
   - Добавь стандартные timestamps, если их нет

4. Покажи сгенерированный Prisma-блок и спроси подтверждение.

5. После подтверждения:
   - Выполни `npx prisma generate`
   - Выполни `npx prisma migrate dev --name add_{entity_lowercase}` (только после моего "approve" или "yes")

6. Создай папку `src/{entity}s/` (kebab-case plural: users, products)

7. Внутри создай:
   - dto/
     - create-{entity}.dto.ts — class с @ApiProperty({ description: "...", example: "..." }), class-validator
     - update-{entity}.dto.ts — PartialType<Create...Dto>
   - {entity}.entity.ts — если нужно, но чаще используй Prisma type
   - {entity}s.service.ts — Injectable, CRUD-методы с try/catch, Prisma error mapping (P2025 → NotFoundException и т.д.), JSDoc
   - {entity}s.controller.ts — @Controller('{entity}s'), @ApiTags('{Entity}s'), все методы с @ApiOperation, @ApiResponse({ type: ... }), @ApiNotFoundResponse()
   - {entity}s.module.ts — @Module({ controllers: [...], providers: [...], exports: [...] если нужно })

8. Обнови `app.module.ts` — импортируй новый модуль

9. Добавь комментарии, где логика неочевидна (например, обработка уникальности)

10. В конце:
    - Покажи полный план файлов и изменений
    - Спроси подтверждение на создание/изменение файлов
    - Если approve — примени изменения

**Strict rules to follow:**
- snake_case для БД-полей и ключей в объектах
- strict typing, no any без комментария-обоснования
- @ApiProperty с description и example для каждого поля
- Prisma error handling в сервисе
- После create/update/delete — предложи инвалидацию кэша, если cache-manager есть