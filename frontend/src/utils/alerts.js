import Swal from 'sweetalert2'

// cores do tema (o estilo dos botões vem de tema.css)
const swalConfig = {
  confirmButtonColor: '#2c6eb5',
  cancelButtonColor: '#75767a',
}

export const showAlert = (title, text, icon = 'info') => {
  return Swal.fire({
    title,
    text,
    icon,
    ...swalConfig
  })
}

export const showConfirm = async (title, text) => {
  const { isConfirmed } = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim',
    cancelButtonText: 'Cancelar',
    ...swalConfig
  })
  return isConfirmed
}

// Pede um texto obrigatório (justificativa, motivo). Devolve null se a pessoa desistir.
export const pedirTexto = async (title, text, placeholder = 'Descreva o motivo') => {
  const { isConfirmed, value } = await Swal.fire({
    title,
    text,
    input: 'textarea',
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Confirmar',
    cancelButtonText: 'Voltar',
    inputValidator: (v) => (!v || !v.trim() ? 'Informe o motivo.' : undefined),
    ...swalConfig,
  })
  return isConfirmed ? value.trim() : null
}

export const showError = (text) => {
  return Swal.fire({
    title: 'Atenção',
    text,
    icon: 'error',
    ...swalConfig
  })
}

export const showSuccess = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    timer: 2000,
    showConfirmButton: false,
    ...swalConfig
  })
}
