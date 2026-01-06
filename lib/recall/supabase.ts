import { supabase } from '@/lib/supabase'
import { 
  RecallCase, 
  RecallLog, 
  RecallPhoto, 
  CreateCaseData, 
  CreateLogData, 
  UpdateLogData,
  SearchFilters,
  RecallCaseWithLogs,
  RecallLogWithPhotos
} from './types'

// Cases
export async function getCases(limit = 20, offset = 0): Promise<RecallCaseWithLogs[]> {
  const { data: user } = await supabase.auth.getUser()
  console.log('getCases: limit:', limit, 'offset:', offset)
  
  if (!user.user) {
    console.log('getCases: No authenticated user')
    throw new Error('User not authenticated')
  }

  console.log('getCases: Fetching cases for user, limit:', limit, 'offset:', offset)

  const { data, error } = await supabase
    .from('recall_cases')
    .select(`
      *,
      logs:recall_logs(count),
      photos:recall_logs(recall_photos(count))
    `)
    .eq('owner_id', user.user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('getCases: Database error:', error)
    throw error
  }
  
  console.log('getCases: Raw database result count:', data?.length)
  if (data) {
    data.forEach((case_, index) => {
      console.log(`Case ${index + 1}:`, case_.title, 'ID:', case_.id, 'Updated:', case_.updated_at)
    })
  }
  
  return data?.map(case_ => ({
    ...case_,
    log_count: case_.logs?.[0]?.count || 0,
    photo_count: case_.photos?.reduce((sum: number, log: any) => sum + (log.recall_photos?.[0]?.count || 0), 0) || 0
  })) || []
}

export async function getDeletedCases(limit = 50): Promise<RecallCaseWithLogs[]> {
  const { data: user } = await supabase.auth.getUser()
  console.log('getDeletedCases: limit:', limit)
  
  if (!user.user) {
    console.log('getDeletedCases: No authenticated user')
    throw new Error('User not authenticated')
  }

  console.log('getDeletedCases: Fetching deleted cases for user, limit:', limit)

  const { data, error } = await supabase
    .from('recall_cases')
    .select(`
      *,
      logs:recall_logs(count),
      photos:recall_logs(recall_photos(count))
    `)
    .eq('owner_id', user.user.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getDeletedCases: Database error:', error)
    throw error
  }
  
  console.log('getDeletedCases: Raw database result count:', data?.length)
  if (data) {
    data.forEach((case_, index) => {
      console.log(`Deleted Case ${index + 1}:`, case_.title, 'ID:', case_.id, 'Deleted:', case_.deleted_at)
    })
  }
  
  return data?.map(case_ => ({
    ...case_,
    log_count: case_.logs?.[0]?.count || 0,
    photo_count: case_.photos?.reduce((sum: number, log: any) => sum + (log.recall_photos?.[0]?.count || 0), 0) || 0
  })) || []
}

export async function restoreCase(id: string): Promise<void> {
  const { error } = await supabase
    .from('recall_cases')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) throw error
}

export async function getCase(id: string): Promise<RecallCaseWithLogs | null> {
  const { data, error } = await supabase
    .from('recall_cases')
    .select(`
      *,
      logs:recall_logs(
        *,
        photos:recall_photos(
          id,
          storage_path,
          original_filename,
          created_at
        )
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) throw error
  
  return data || null
}

export async function createCase(caseData: CreateCaseData): Promise<RecallCase> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('recall_cases')
    .insert({
      ...caseData,
      owner_id: user.user.id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCase(id: string, updates: Partial<CreateCaseData>): Promise<RecallCase> {
  const { data, error } = await supabase
    .from('recall_cases')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase
    .from('recall_cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// Logs
export async function getLog(id: string): Promise<RecallLogWithPhotos | null> {
  const { data, error } = await supabase
    .from('recall_logs')
    .select(`
      *,
      photos:recall_photos(*),
      case:recall_cases(title, client_name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createLog(logData: CreateLogData): Promise<RecallLog> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('recall_logs')
    .insert({
      ...logData,
      owner_id: user.user.id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateLog(id: string, updates: UpdateLogData): Promise<RecallLog> {
  const { data, error } = await supabase
    .from('recall_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('recall_logs')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Photos
export async function getAllCasePhotos(caseId: string): Promise<RecallPhoto[]> {
  const { data: logIds } = await supabase
    .from('recall_logs')
    .select('id')
    .eq('case_id', caseId)

  if (!logIds || logIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('recall_photos')
    .select(`
      id,
      log_id,
      owner_id,
      storage_path,
      original_filename,
      created_at
    `)
    .in('log_id', logIds.map(log => log.id))
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching case photos:', error)
    throw error
  }

  return data || []
}

export async function getPhotosForLog(logId: string): Promise<RecallPhoto[]> {
  const { data, error } = await supabase
    .from('recall_photos')
    .select('*')
    .eq('log_id', logId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createPhoto(logId: string, storagePath: string, filename?: string): Promise<RecallPhoto> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('recall_photos')
    .insert({
      log_id: logId,
      owner_id: user.user.id,
      storage_path: storagePath,
      original_filename: filename
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePhoto(id: string): Promise<void> {
  const { error } = await supabase
    .from('recall_photos')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Search
export async function searchCases(filters: SearchFilters): Promise<RecallCaseWithLogs[]> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User not authenticated')

  let query = supabase
    .from('recall_cases')
    .select(`
      *,
      logs:recall_logs(count)
    `)
    .eq('owner_id', user.user.id)
    .is('deleted_at', null)

  if (filters.query) {
    query = query.or(`title.ilike.%${filters.query}%,client_name.ilike.%${filters.query}%`)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data?.map(case_ => ({
    ...case_,
    log_count: case_.logs?.[0]?.count || 0
  })) || []
}

export async function searchLogs(filters: SearchFilters): Promise<RecallLogWithPhotos[]> {
  let query = supabase
    .from('recall_logs')
    .select(`
      *,
      photos:recall_photos(count),
      case:recall_cases(title, client_name)
    `)

  if (filters.case_id) {
    query = query.eq('case_id', filters.case_id)
  }

  if (filters.log_type) {
    query = query.eq('log_type', filters.log_type)
  }

  if (filters.query) {
    query = query.ilike('note', `%${filters.query}%`)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data?.map(log => ({
    ...log,
    photo_count: log.photos?.[0]?.count || 0
  })) || []
}