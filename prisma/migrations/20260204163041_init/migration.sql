-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'teacher', 'student');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "birthday" TIMESTAMP(3),
    "city" TEXT,
    "telegram" TEXT,
    "instagram" TEXT,
    "avatar" TEXT,
    "super_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "title_space" TEXT NOT NULL DEFAULT 'Lirnexa',
    "icon" TEXT NOT NULL DEFAULT '',
    "languages" TEXT[] DEFAULT ARRAY['uk']::TEXT[],
    "select_mode" BOOLEAN NOT NULL DEFAULT false,
    "bg_color" TEXT NOT NULL DEFAULT 'white',
    "primary_color" TEXT NOT NULL DEFAULT 'blue',
    "secondary_color" TEXT NOT NULL DEFAULT 'gray',
    "bg_color_dark" TEXT NOT NULL DEFAULT 'dark',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "spaces_user_id_key" ON "spaces"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
