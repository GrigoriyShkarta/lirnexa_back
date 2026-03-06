import { Prisma } from '@prisma/client';

/**
 * Prisma select object for space settings.
 */
export const PERSONALIZATION_SELECT_FIELDS = {
  id: true,
  title_space: true,
  icon: true,
  languages: true,
  select_mode: true,
  bg_color: true,
  primary_color: true,
  secondary_color: true,
  bg_color_dark: true,
  is_white_sidebar_color: true,
  is_show_sidebar_icon: true,
  font_family: true,
  currency: true,
  dashboard_personalization: {
    select: {
      student_dashboard_title: true,
      student_dashboard_description: true,
      student_dashboard_hero_image: true,
      student_announcement: true,
      is_show_student_progress: true,
      student_social_instagram: true,
      student_support_telegram: true,
      dashboard_title: true,
      dashboard_description: true,
      dashboard_hero_image: true,
    },
  },
};

/**
 * Prisma select object for user profile retrieval.
 * Specifies which fields should be returned from the database.
 */
export const SELECT_CATEGORIES = {
  id: true,
  name: true,
  color: true,
}

export const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  birthday: true,
  city: true,
  telegram: true,
  instagram: true,
  avatar: true,
  super_admin_id: true,
  teacher_id: true,
  is_premium: true,
  learning_goals: true,
  status: true,
  is_avatar_locked: true,
  is_name_locked: true,
  deactivation_date: true,
  can_student_create_tracker: true,
  can_student_edit_tracker: true,
  personalization: {
    select: PERSONALIZATION_SELECT_FIELDS,
  },
  categories: {
    select: SELECT_CATEGORIES,
  },
  notifications: {
    select: {
      id: true,
      message_id: true,
      message_title: true,
      message: true,
      is_read: true,
      created_at: true,
    },
    orderBy: { created_at: Prisma.SortOrder.desc },
  },
};

/**
 * Prisma select object for user listing (minimal fields).
 */
export const USER_LIST_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  birthday: true,
  city: true,
  telegram: true,
  instagram: true,
  avatar: true,
  super_admin_id: true,
  teacher_id: true,
  is_premium: true,
  learning_goals: true,
  status: true,
  is_avatar_locked: true,
  is_name_locked: true,
  deactivation_date: true,
  can_student_create_tracker: true,
  can_student_edit_tracker: true,
  categories: {
    select: SELECT_CATEGORIES,
  },
};
