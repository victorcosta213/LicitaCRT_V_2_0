import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

/**
 * Exporta um array de objetos para Excel
 * @param {Array<object>} rows
 * @param {string} filename  (ex.: 'processos.xlsx')
 */
export function exportToExcel(rows, filename = 'dados.xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, filename)
}

/**
 * Exporta uma tabela para PDF
 * @param {Array<object>} rows
 * @param {Array<{header:string, dataKey:string}>} columns
 * @param {string} title
 * @param {string} filename (ex.: 'processos.pdf')
 */
export function exportToPdf(rows, columns, title = 'Relatório', filename = 'dados.pdf') {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)

  doc.autoTable({
    startY: 22,
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => r[c.dataKey] ?? '')),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [13, 110, 253] }, // opcional: cor padrão bootstrap primary
  })

  doc.save(filename)
}
