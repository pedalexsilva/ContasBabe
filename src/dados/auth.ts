import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import type { Casal, Pessoa } from '../tipos'

/**
 * Autenticação pelo fluxo NATIVO do Google.
 *
 * O SDK web faria `signInWithPopup`/`signInWithRedirect`, e o Google bloqueia
 * OAuth dentro de WebViews embebidas (`disallowed_useragent`) — encalhava aqui
 * mesmo. Por isso o login passa pelo plugin, que usa o Google Sign-In do
 * sistema, e é essa sessão que o serviço em Kotlin herda para escrever.
 *
 * Se isto der `DEVELOPER_ERROR` na primeira tentativa, quase de certeza faltam
 * os fingerprints SHA-1 e SHA-256 (dos keystores de debug E de release) na
 * consola Firebase.
 */

export interface UtilizadorAtual {
  uid: string
  email: string | null
  nome: string | null
}

export async function entrarComGoogle(): Promise<UtilizadorAtual | null> {
  const { user } = await FirebaseAuthentication.signInWithGoogle()
  if (!user) return null
  return { uid: user.uid, email: user.email ?? null, nome: user.displayName ?? null }
}

export async function sair(): Promise<void> {
  await FirebaseAuthentication.signOut()
}

export async function utilizadorAtual(): Promise<UtilizadorAtual | null> {
  const { user } = await FirebaseAuthentication.getCurrentUser()
  if (!user) return null
  return { uid: user.uid, email: user.email ?? null, nome: user.displayName ?? null }
}

export async function ouvirAutenticacao(
  aoMudar: (u: UtilizadorAtual | null) => void,
): Promise<() => void> {
  const handle = await FirebaseAuthentication.addListener('authStateChange', ({ user }) => {
    aoMudar(user ? { uid: user.uid, email: user.email ?? null, nome: user.displayName ?? null } : null)
  })
  return () => {
    void handle.remove()
  }
}

/**
 * Qual das duas pessoas do casal é este login.
 *
 * Devolve `null` quando o UID não está mapeado — que é o estado normal na
 * primeira instalação, antes do passo "escolher quem é quem".
 */
export function pessoaDoUid(casal: Casal, uid: string): Pessoa | null {
  return casal.pessoas.find((p) => p.uid === uid) ?? null
}

/** A outra pessoa do casal. Num casal de duas, é sempre exatamente uma. */
export function outraPessoa(casal: Casal, pessoaId: string): Pessoa | null {
  return casal.pessoas.find((p) => p.id !== pessoaId) ?? null
}
