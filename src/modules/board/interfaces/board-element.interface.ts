/** All supported board element types */
export type BoardElementType =
  | 'path'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'video'
  | 'audio'
  | 'image'
  | 'file'
  | 'youtube'
  | 'embed'
  | 'link';

/** Common fields shared across all element types */
export interface BoardElementBase {
  /** Unique element identifier (UUID generated on frontend) */
  id: string;
  /** Element type discriminator */
  type: BoardElementType;
  /** CSS color value */
  color?: string;
  /** Rotation angle in degrees */
  angle?: number;
  /** Opacity 0–1 */
  opacity?: number;
}

/** Freehand drawing path element */
export interface PathElement extends BoardElementBase {
  type: 'path';
  /** SVG path data string */
  d: string;
  stroke_width?: number;
  stroke_style?: string;
}

/** Text element */
export interface TextElement extends BoardElementBase {
  type: 'text';
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font_size?: number;
  font_family?: string;
  font_weight?: string;
  font_style?: string;
  text_decoration?: string;
}

/** Rectangle shape element */
export interface RectElement extends BoardElementBase {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke_width?: number;
  stroke_style?: string;
}

/** Ellipse shape element */
export interface EllipseElement extends BoardElementBase {
  type: 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke_width?: number;
  stroke_style?: string;
}

/** Uploaded video element */
export interface VideoElement extends BoardElementBase {
  type: 'video';
  src: string;
  name: string;
  size?: number;
  ext?: string;
}

/** Uploaded audio element */
export interface AudioElement extends BoardElementBase {
  type: 'audio';
  src: string;
  name: string;
  size?: number;
  ext?: string;
}

/** Uploaded image element */
export interface ImageElement extends BoardElementBase {
  type: 'image';
  src: string;
  name: string;
  size?: number;
  ext?: string;
  w: number;
  h: number;
}

/** Uploaded file element */
export interface FileElement extends BoardElementBase {
  type: 'file';
  src: string;
  name: string;
  size?: number;
  ext?: string;
}

/** Embedded YouTube video element */
export interface YoutubeElement extends BoardElementBase {
  type: 'youtube';
  youtube_id: string;
}

/** HTML embed element */
export interface EmbedElement extends BoardElementBase {
  type: 'embed';
  html?: string;
  src?: string;
}

/** Link preview element */
export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
}

export interface LinkElement extends BoardElementBase {
  type: 'link';
  url: string;
  preview?: LinkPreview;
}

/** Union of all element types */
export type BoardElement =
  | PathElement
  | TextElement
  | RectElement
  | EllipseElement
  | VideoElement
  | AudioElement
  | ImageElement
  | FileElement
  | YoutubeElement
  | EmbedElement
  | LinkElement;

/** Board display settings */
export interface BoardSettings {
  /** Background color: 'auto' or HEX string */
  bg_color: string;
  /** Grid overlay type */
  grid_type: 'cells' | 'dots' | 'none';
  /** Theme preference */
  board_theme: 'auto' | 'light' | 'dark';
}
