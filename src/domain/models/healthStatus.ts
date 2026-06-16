// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/models/health_status.py

export interface HealthStatus {
  service: string
  status: 'ok' | 'error'
  details?: string
}
