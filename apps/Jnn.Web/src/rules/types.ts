import type { JnnModel, JnnElement, PropertySet } from '../domain/model';
import type { ClashRecord } from '../clash/clashResults';
import type { ClashResult } from '../clash/narrowphase';

export type RuleCategory =
  | 'Naming'    // quy tắc đặt tên
  | 'Geometry'  // hình học (thiếu geometry, volume = 0, bounding box rỗng)
  | 'Property'  // thiếu thuộc tính bắt buộc (Width, Thickness, etc.)
  | 'Spatial'   // cấu trúc không gian (element không thuộc tầng nào)
  | 'Clash';    // kiểm tra liên quan clash

export type RuleSeverity = 'Error' | 'Warning' | 'Info';

export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  elementId: string;
  elementName: string;
  globalId?: string;
  modelId: string;
  message: string;        // mô tả vi phạm, tiếng Việt
  messageEn: string;      // tiếng Anh
}

export interface RuleContext {
  models: JnnModel[];
  elements: JnnElement[];
  getProperties: (id: string) => Promise<PropertySet[]>;
  clashResults?: (ClashResult | ClashRecord)[];
}

export interface RuleDefinition {
  id: string;
  name: string;           // tiếng Việt
  nameEn: string;         // tiếng Anh
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  // Hàm kiểm tra: nhận context, trả về danh sách vi phạm
  check: (ctx: RuleContext) => Promise<RuleViolation[]>;
}

export interface RuleCheckResult {
  totalViolations: number;
  byRule: Map<string, RuleViolation[]>;
  bySeverity: {
    Error: number;
    Warning: number;
    Info: number;
  };
  duration: number; // in milliseconds
  ruleErrors?: Array<{ ruleId: string; error: string }>;
}
