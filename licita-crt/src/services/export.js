import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { toInputDate } from '../utils/dates'

console.log('[export.js] loaded')

const isTimestamp = (v) => v && typeof v.toDate === 'function'
const toDate = (v) => {
  if (!v) return null
  if (isTimestamp(v)) return v.toDate()
  if (v instanceof Date) return isNaN(v) ? null : v
  return null
}
const fmtCell = (val) => {
  const d = toDate(val)
  if (d) return toInputDate(d)
  if (val === undefined || val === null) return ''
  return String(val)
}

export const exportToExcel = (rows, filename = 'dados.xlsx', columns) => {
  const data = Array.isArray(rows) ? rows : []
  if (!data.length) { alert('Não há dados para exportar.'); return }

  let ws
  if (Array.isArray(columns) && columns.length) {
    const aoa = [
      columns.map(c => c.header),
      ...data.map(r => columns.map(c => fmtCell(r[c.dataKey])))
    ]
    ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = columns.map((c) => {
      const maxLen = Math.max(
        c.header.length,
        ...data.map(r => String(fmtCell(r[c.dataKey] || '')).length)
      )
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) }
    })
  } else {
    ws = XLSX.utils.json_to_sheet(data.map(row => {
      const out = {}
      for (const [k, v] of Object.entries(row)) out[k] = fmtCell(v)
      return out
    }))
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, filename)
}

export const exportToPdf = (rows, columns, title = 'Relatório', filename = 'relatorio.pdf') => {
  const data = Array.isArray(rows) ? rows : []
  if (!data.length) { alert('Não há dados para exportar.'); return }
  if (!Array.isArray(columns) || !columns.length) { alert('Defina as colunas para exportar.'); return }

  const isWideTable = columns.length > 6
  const orient = isWideTable ? 'landscape' : 'portrait'
  const doc = new jsPDF(orient, 'pt', 'a4')
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const TITLE_Y = 48
  const SUBTITLE_Y = TITLE_Y + 18
  const TABLE_START_Y = SUBTITLE_Y + 24

  const now = new Date()
  const subtitle = `Gerado em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, pageWidth / 2, TITLE_Y, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle, pageWidth / 2, SUBTITLE_Y, { align: 'center' })
  doc.setTextColor(0)


  const MARGIN_L = 40
  const MARGIN_R = 40
  const fontSize = columns.length > 10 ? 7 : columns.length > 7 ? 8 : 9
  const cellPadding = columns.length > 10 ? 2 : 4

  const head = [columns.map(c => c.header)]
  const body = data.map(r => columns.map(c => fmtCell(r[c.dataKey])))

  autoTable(doc, {
    head,
    body,
    startY: TABLE_START_Y,
    theme: 'grid',
    tableWidth: 'auto',
    margin: { left: MARGIN_L, right: MARGIN_R, top: TABLE_START_Y, bottom: 40 },
    styles: {
      font: 'helvetica',
      fontSize,
      cellPadding,
      overflow: 'linebreak',
      cellWidth: 'auto',
      lineWidth: 0.5,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [13, 110, 253],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    showHead: 'everyPage',
    horizontalPageBreak: isWideTable,
    horizontalPageBreakRepeat: isWideTable ? [0] : null,
    columnStyles: Object.fromEntries(
      columns.map((c, i) => {
        const isTexty = /objeto|descri|observa/i.test((c.dataKey || '') + ' ' + (c.header || ''))
        return [i, { halign: isTexty ? 'left' : 'center' }]
      })
    ),
    alternateRowStyles: { fillColor: [245, 248, 255] },

    didDrawPage: () => {
      doc.setFontSize(10)
      doc.setTextColor(150)
      doc.text(title, MARGIN_L, 30)

      const cur = doc.internal.getNumberOfPages()
      const txt = `Página ${cur}`
      doc.setDrawColor(220)
      doc.line(MARGIN_L, pageHeight - 28, pageWidth - MARGIN_R, pageHeight - 28)
      doc.setTextColor(120)
      doc.text(txt, pageWidth - MARGIN_R, pageHeight - 16, { align: 'right' })
      doc.setTextColor(0)
    }
  })

  doc.save(filename)
}
