import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { RecallCase, RecallLog, RecallPhoto } from './types'
import { getSignedUrl, downloadPhoto } from './storage'

// PDF Export
export async function exportCaseToPDF(
  case_: RecallCase,
  logs: (RecallLog & { photos?: RecallPhoto[] })[],
  includePhotos = true
): Promise<void> {
  const pdf = new jsPDF()
  let yPos = 20

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth = 170): number => {
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + (lines.length * 7) + 5
  }

  // Header
  pdf.setFontSize(18)
  pdf.setFont(undefined, 'bold')
  yPos = addText(case_.title, 20, yPos)
  
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'normal')
  
  if (case_.client_name) {
    yPos = addText(`Client: ${case_.client_name}`, 20, yPos)
  }
  
  if (case_.location_text) {
    yPos = addText(`Location: ${case_.location_text}`, 20, yPos)
  }

  yPos = addText(`Created: ${new Date(case_.created_at).toLocaleDateString()}`, 20, yPos)
  yPos += 10

  // Logs
  for (const log of logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    // Check if we need a new page
    if (yPos > 250) {
      pdf.addPage()
      yPos = 20
    }

    pdf.setFont(undefined, 'bold')
    yPos = addText(`${log.log_type} - ${new Date(log.created_at).toLocaleString()}`, 20, yPos)
    
    pdf.setFont(undefined, 'normal')
    if (log.note.trim()) {
      yPos = addText(log.note, 20, yPos)
    }

    // Photo info
    const photoCount = log.photos?.length || 0
    if (photoCount > 0) {
      yPos = addText(`📷 ${photoCount} photo${photoCount > 1 ? 's' : ''} attached`, 20, yPos)
      
      if (includePhotos && log.photos) {
        // Add thumbnails (simplified - just show photo names for now)
        const photoNames = log.photos.slice(0, 3).map(p => p.original_filename || 'photo').join(', ')
        yPos = addText(`Files: ${photoNames}${photoCount > 3 ? ` +${photoCount - 3} more` : ''}`, 25, yPos)
      }
    }

    yPos += 10
  }

  // Footer
  if (yPos > 250) {
    pdf.addPage()
    yPos = 20
  }
  
  pdf.setFontSize(10)
  pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, yPos + 10)
  pdf.text('Recall - Case Management System', 20, yPos + 20)

  // Download
  const fileName = `${case_.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_case_report.pdf`
  pdf.save(fileName)
}

// ZIP Export for photos
export async function exportCasePhotosToZip(
  case_: RecallCase,
  logs: (RecallLog & { photos?: RecallPhoto[] })[]
): Promise<void> {
  const zip = new JSZip()
  
  // Create case summary
  const summary = generateCaseSummary(case_, logs)
  zip.file('case_summary.txt', summary)

  let totalPhotos = 0
  
  try {
    for (const log of logs) {
      if (!log.photos || log.photos.length === 0) continue

      // Create folder for this log
      const logDate = new Date(log.created_at).toISOString().split('T')[0]
      const logTime = new Date(log.created_at).toTimeString().slice(0, 5).replace(':', '')
      const folderName = `${logDate}_${logTime}_${log.log_type}`
      
      for (let i = 0; i < log.photos.length; i++) {
        const photo = log.photos[i]
        totalPhotos++
        
        try {
          const blob = await downloadPhoto(photo.storage_path)
          const fileName = photo.original_filename || `photo_${i + 1}.jpg`
          zip.folder(folderName)?.file(fileName, blob)
        } catch (error) {
          console.error(`Failed to download photo ${photo.id}:`, error)
        }
      }
    }

    if (totalPhotos === 0) {
      throw new Error('No photos found to export')
    }

    // Generate and download ZIP
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${case_.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_photos.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error creating ZIP:', error)
    throw new Error('Failed to create photo archive')
  }
}

// ZIP Export for single log photos
export async function exportLogPhotosToZip(
  log: RecallLog & { photos?: RecallPhoto[] },
  caseName?: string
): Promise<void> {
  if (!log.photos || log.photos.length === 0) {
    throw new Error('No photos to export')
  }

  const zip = new JSZip()
  
  try {
    for (let i = 0; i < log.photos.length; i++) {
      const photo = log.photos[i]
      
      try {
        const blob = await downloadPhoto(photo.storage_path)
        const fileName = photo.original_filename || `photo_${i + 1}.jpg`
        zip.file(fileName, blob)
      } catch (error) {
        console.error(`Failed to download photo ${photo.id}:`, error)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    
    const logDate = new Date(log.created_at).toISOString().split('T')[0]
    const fileName = `${caseName ? caseName + '_' : ''}${log.log_type}_${logDate}_photos.zip`
    
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.replace(/[^a-z0-9_.]/gi, '_').toLowerCase()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error creating ZIP:', error)
    throw new Error('Failed to create photo archive')
  }
}

// Generate case summary text
function generateCaseSummary(
  case_: RecallCase,
  logs: (RecallLog & { photos?: RecallPhoto[] })[]
): string {
  let summary = `Case: ${case_.title}\n`
  
  if (case_.client_name) {
    summary += `Client: ${case_.client_name}\n`
  }
  
  if (case_.location_text) {
    summary += `Location: ${case_.location_text}\n`
  }
  
  summary += `Created: ${new Date(case_.created_at).toLocaleString()}\n`
  summary += `Last Updated: ${new Date(case_.updated_at).toLocaleString()}\n\n`
  
  summary += `=== LOGS (${logs.length}) ===\n\n`
  
  const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  
  sortedLogs.forEach((log, index) => {
    summary += `${index + 1}. ${log.log_type} - ${new Date(log.created_at).toLocaleString()}\n`
    
    if (log.note.trim()) {
      summary += `   ${log.note}\n`
    }
    
    const photoCount = log.photos?.length || 0
    if (photoCount > 0) {
      summary += `   📷 ${photoCount} photo${photoCount > 1 ? 's' : ''}\n`
    }
    
    summary += '\n'
  })
  
  summary += `Generated: ${new Date().toLocaleString()}\n`
  summary += 'Recall - Case Management System'
  
  return summary
}

// Download single photo
export async function downloadSinglePhoto(photo: RecallPhoto): Promise<void> {
  try {
    const signedUrl = await getSignedUrl(photo.storage_path)
    const response = await fetch(signedUrl)
    const blob = await response.blob()
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = photo.original_filename || 'photo.jpg'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading photo:', error)
    throw new Error('Failed to download photo')
  }
}