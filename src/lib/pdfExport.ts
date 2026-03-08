/**
 * Export an HTML element to a multi-page PDF using html2canvas and jspdf.
 * Works in both browser and Electron.
 */
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const PDF_SCALE = 2

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string = 'WA-Log-Report.pdf'
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: PDF_SCALE,
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    allowTaint: true,
    backgroundColor: '#ffffff',
  })

  const imgW = canvas.width
  const imgH = canvas.height
  const pdf = new jsPDF('p', 'pt', 'a4')
  const pageW = A4_WIDTH_PT
  const pageH = A4_HEIGHT_PT
  const scale = pageW / imgW
  const scaledImgH = imgH * scale
  let heightLeft = scaledImgH
  let position = 0
  let page = 0

  while (heightLeft > 0) {
    if (page > 0) pdf.addPage()
    const srcY = (position / scale)
    const srcH = Math.min(pageH / scale, imgH - srcY)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = imgW
    cropCanvas.height = srcH
    const ctx = cropCanvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, imgW, srcH)
      ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH)
    }
    const cropData = cropCanvas.toDataURL('image/jpeg', 0.92)
    const cropScaledH = srcH * scale
    pdf.addImage(cropData, 'JPEG', 0, 0, pageW, Math.min(cropScaledH, pageH))
    heightLeft -= pageH
    position += pageH / scale
    page += 1
  }

  pdf.save(filename)
}
