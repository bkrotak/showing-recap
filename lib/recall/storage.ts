import { supabase } from '@/lib/supabase'

export interface UploadResult {
  path: string
  url?: string
}

// Upload a single file to recall bucket
export async function uploadPhoto(
  file: File, 
  caseId: string, 
  logId: string
): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${fileExt}`
  const filePath = `recall_cases/${caseId}/logs/${logId}/${fileName}`

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be less than 5MB')
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }

  const { data, error } = await supabase.storage
    .from('recall')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error('Upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }

  return {
    path: data.path
  }
}

// Upload multiple files
export async function uploadPhotos(
  files: File[], 
  caseId: string, 
  logId: string,
  onProgress?: (index: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.(i + 1, files.length)
    
    try {
      const result = await uploadPhoto(file, caseId, logId)
      results.push(result)
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
      throw error
    }
  }

  return results
}

// Get signed URL for viewing/downloading
export async function getSignedUrl(path: string, expiresIn = 600): Promise<string> {  if (!path || !path.trim()) {
    throw new Error('Invalid storage path provided')
  }
  const { data, error } = await supabase.storage
    .from('recall')
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`)
  }

  return data.signedUrl
}

// Get multiple signed URLs
export async function getSignedUrls(paths: string[], expiresIn = 600): Promise<Record<string, string>> {
  // Filter out invalid paths
  const validPaths = paths.filter(path => path && path.trim())
  
  if (validPaths.length === 0) {
    return {}
  }

  const urls: Record<string, string> = {}
  
  for (const path of validPaths) {
    try {
      urls[path] = await getSignedUrl(path, expiresIn)
    } catch (error) {
      console.error(`Failed to get signed URL for ${path}:`, error)
      // Don't include this path in results
    }
  }
  
  return urls
}

// Delete a single file
export async function deletePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('recall')
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`)
  }
}

// Delete multiple files
export async function deletePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const { error } = await supabase.storage
    .from('recall')
    .remove(paths)

  if (error) {
    throw new Error(`Failed to delete photos: ${error.message}`)
  }
}

// Delete entire case folder (all photos for a case)
export async function deleteCaseFolder(caseId: string): Promise<void> {
  const { data: files, error: listError } = await supabase.storage
    .from('recall')
    .list(`recall_cases/${caseId}`, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (listError) {
    throw new Error(`Failed to list case files: ${listError.message}`)
  }

  if (files && files.length > 0) {
    const filePaths = files.map(file => `recall_cases/${caseId}/${file.name}`)
    await deletePhotos(filePaths)
  }
}

// Check if bucket exists and is accessible
export async function checkStorageBucket(): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.getBucket('recall')
    return !error && !!data
  } catch {
    return false
  }
}

// Download file as blob for client-side operations
export async function downloadPhoto(path: string): Promise<Blob> {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid storage path provided')
  }

  const { data, error } = await supabase.storage
    .from('recall')
    .download(path)

  if (error) {
    throw new Error(`Failed to download photo: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from photo download')
  }

  return data
}