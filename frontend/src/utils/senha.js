// Regras da senha que a pessoa escolhe para si (primeiro acesso e redefinição pelo administrador)
export const SENHA_MINIMA = 8

// Devolve a mensagem do primeiro problema encontrado, ou '' se a senha serve
export function validarNovaSenha(senha, confirmacao) {
  if (senha.length < SENHA_MINIMA) return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.'
  if (senha !== confirmacao) return 'As senhas não conferem.'
  return ''
}
