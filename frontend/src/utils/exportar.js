import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// colunas: [{ key, label }]; linhas: objetos com valores já formatados em texto/número
export function exportarXlsx(nomeArquivo, colunas, linhas, titulo = 'Relatório') {
  const aoa = [colunas.map((c) => c.label), ...linhas.map((l) => colunas.map((c) => l[c.key] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colunas.map((c, i) => ({
    wch: Math.min(48, Math.max(c.label.length, ...linhas.map((l) => String(l[colunas[i].key] ?? '').length)) + 2),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 30))
  XLSX.writeFile(wb, nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`)
}

export function exportarPdf(nomeArquivo, titulo, colunas, linhas) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(titulo, 40, 40)
  doc.setFontSize(9)
  doc.text(`CRT-08 · gerado em ${new Date().toLocaleString('pt-BR')}`, 40, 56)
  autoTable(doc, {
    startY: 70,
    head: [colunas.map((c) => c.label)],
    body: linhas.map((l) => colunas.map((c) => String(l[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 64, 175] },
  })
  doc.save(nomeArquivo.endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`)
}
