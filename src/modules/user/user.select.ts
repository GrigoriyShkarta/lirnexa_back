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
  personalization: {
    select: PERSONALIZATION_SELECT_FIELDS,
  },
  categories: {
    select: SELECT_CATEGORIES,
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
  categories: {
    select: SELECT_CATEGORIES,
  },
};
