import Swal from 'sweetalert2'

const swalConfig = {
  confirmButtonColor: '#0d6efd',
  cancelButtonColor: '#6c757d',
  borderRadius: '16px',
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
