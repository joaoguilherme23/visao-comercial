import api from './client'
import { Notificacao } from '../types'

export const notificacoesApi = {
  list: (clienteId: string): Promise<Notificacao[]> =>
    api.get<Notificacao[]>(`/notificacoes/${clienteId}`).then((r) => r.data),
}
