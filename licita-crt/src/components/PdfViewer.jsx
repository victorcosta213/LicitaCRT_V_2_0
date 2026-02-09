export default function PdfViewer({ url, height = 480 }) {
  if (!url) return null
  const src = url.includes('?') ? `${url}&embedded=true` : `${url}?embedded=true`
  return (
    <div className="pdf-wrap border rounded-3">
      <div className="d-flex justify-content-between align-items-center p-2 border-bottom">
        <strong className="small mb-0">Visualização do PDF</strong>
        <a className="btn btn-sm btn-outline-primary" href={url} target="_blank" rel="noreferrer">Abrir em nova aba</a>
      </div>
      <div className="ratio" style={{ '--bs-aspect-ratio': '56%' }}>
        <object data={src} type="application/pdf" width="100%" height="100%" aria-label="PDF">
          <iframe title="pdf" src={src} width="100%" height={height} />
        </object>
      </div>
    </div>
  )
}
