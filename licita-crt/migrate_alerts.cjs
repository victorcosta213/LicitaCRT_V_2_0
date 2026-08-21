const fs = require('fs');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Add import if not present
  if (content.includes('alert(') || content.includes('confirm(')) {
    if (!content.includes('../utils/alerts')) {
      if (content.includes("import { exportToExcel")) {
        content = content.replace(
          "import { exportToExcel, exportToPdf } from '../services/export'",
          "import { exportToExcel, exportToPdf } from '../services/export'\nimport { showAlert, showConfirm, showError, showSuccess } from '../utils/alerts'"
        );
      }
    }
  }

  // Replace confirm inside async functions
  content = content.replace(/if \(\!confirm\((.*?)\)\) return/g, "if (!(await showConfirm('Atenção', $1))) return");

  // Replace alert strings
  content = content.replace(/alert\('([^']+)'\)/g, "showError('$1')");
  // Replace alert with var
  content = content.replace(/alert\(v\)/g, "showError(v)");
  
  fs.writeFileSync(file, content);
}

processFile('src/pages/Controle.jsx');
processFile('src/pages/Arquivados.jsx');

// For export.js
let exportContent = fs.readFileSync('src/services/export.js', 'utf8');
if (!exportContent.includes('../utils/alerts')) {
  exportContent = "import { showError } from '../utils/alerts';\n" + exportContent;
  exportContent = exportContent.replace(/alert\('([^']+)'\)/g, "showError('$1')");
  fs.writeFileSync('src/services/export.js', exportContent);
}
