export type LogType = 'Before' | 'During' | 'After' | 'Issue' | 'Resolution' | 'Call' | 'Visit' | 'Invoice'

export interface RecallCase {
  id: string
  owner_id: string
  title: string
  client_name?: string
  location_text?: string
  created_at: string
  updated_at: string
}

export interface RecallLog {
  id: string
  case_id: string
  owner_id: string
  log_type: LogType
  note: string
  created_at: string
  updated_at: string
}

export interface RecallPhoto {
  id: string
  log_id: string
  owner_id: string
  storage_path: string
  original_filename?: string
  created_at: string
}

// Extended types with relations
export interface RecallCaseWithLogs extends RecallCase {
  logs?: RecallLog[]
  log_count?: number
  photo_count?: number
}

export interface RecallLogWithPhotos extends RecallLog {
  photos?: RecallPhoto[]
  photo_count?: number
}

// Form types
export interface CreateCaseData {
  title: string
  client_name?: string
  location_text?: string
}

export interface CreateLogData {
  case_id: string
  log_type: LogType
  note: string
}

export interface UpdateLogData {
  log_type?: LogType
  note?: string
}

// Search and filter types
export interface SearchFilters {
  query?: string
  log_type?: LogType
  case_id?: string
}

// Export types
export interface ExportOptions {
  include_photos: boolean
  max_photo_size?: number
}