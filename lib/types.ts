export type FeedbackStatus = 'INTERESTED' | 'NOT_FOR_US' | 'MAYBE'

export interface Showing {
  id: string
  agent_id: string
  public_token: string
  buyer_name: string
  buyer_phone: string
  buyer_email?: string
  address: string
  city: string
  state: string
  zip: string
  showing_datetime: string
  feedback_status?: FeedbackStatus
  feedback_note?: string
  feedback_submitted_at?: string
  created_at: string
  updated_at: string
}

export interface ShowingPhoto {
  id: string
  showing_id: string
  storage_path: string
  original_name: string
  file_size?: number
  mime_type?: string
  uploaded_at: string
}