import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';

import { useLocalizacao } from '@/context/LocalizacaoContext';
import {
  agendarNotificacao,
  cancelarNotificacao,
  estadoPermissaoNotificacoes,
  notificarAgora,
  pedirPermissaoNotificacoes,
  type EstadoPermissao,
} from '@/services/notificacoes';
import { mensagemDeErro, olhoVivo } from '@/services/olhovivo';
import { distanciaEmMetros, formatarDistancia, minutosAPe, type Coordenada } from '@/utils/geo';
import { minutosAteChegada } from '@/utils/tempo';

const INTERVALO_CONSULTA_MS = 30_000;
const VALIDADE_ALERTA_MS = 2 * 60 * 60 * 1000;
export const MARGEM_SAIR_MIN = 2;
export const RAIO_DESCIDA_M = 400;

export type StatusAlerta = 'ativo' | 'disparado' | 'expirado';

type AlertaBase = {
  id: string;
  criadoEm: number;
  status: StatusAlerta;
  codigoParada: number;
  nomeParada: string;
  coordParada: Coordenada;
  mensagem?: string;
};

export type AlertaOnibus = AlertaBase & {
  tipo: 'onibus';
  codigoLinha: number;
  letreiro: string;
  destino: string;
  modo: 'chegada' | 'sair';
  antecedenciaMin: number;
  etaMin: number | null;
  ultimaConsulta?: number;
  idAgendada?: string;
  agendadaPara?: number;
  erro?: string;
};

export type AlertaDescida = AlertaBase & {
  tipo: 'descida';
  letreiro?: string;
  distanciaAtual: number | null;
};

export type Alerta = AlertaOnibus | AlertaDescida;

export type NovoAlertaOnibus = Pick<
  AlertaOnibus,
  'codigoParada' | 'nomeParada' | 'coordParada' | 'codigoLinha' | 'letreiro' | 'destino' | 'modo' | 'antecedenciaMin'
>;
export type NovoAlertaDescida = Pick<AlertaDescida, 'codigoParada' | 'nomeParada' | 'coordParada' | 'letreiro'>;

type ValorContexto = {
  alertas: Alerta[];
  permissaoNotificacao: EstadoPermissao;
  garantirPermissaoNotificacao: () => Promise<EstadoPermissao>;
  criarAlertaOnibus: (dados: NovoAlertaOnibus) => void;
  criarAlertaDescida: (dados: NovoAlertaDescida) => void;
  removerAlerta: (id: string) => void;
  limparConcluidos: () => void;
};

const AlertasContext = createContext<ValorContexto | null>(null);

const estaAtivo = (lista: Alerta[], id: string) => lista.some((a) => a.id === id && a.status === 'ativo');

const novoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function antecedenciaEfetiva(alerta: AlertaOnibus, posicao: Coordenada | null) {
  if (alerta.modo === 'chegada' || !posicao) return alerta.antecedenciaMin;
  return minutosAPe(distanciaEmMetros(posicao, alerta.coordParada)) + MARGEM_SAIR_MIN;
}

function textosDoAviso(alerta: AlertaOnibus, eta: number, posicao: Coordenada | null) {
  const linha = `${alerta.letreiro} (${alerta.destino})`;
  if (alerta.modo === 'sair') {
    const aPe = posicao ? minutosAPe(distanciaEmMetros(posicao, alerta.coordParada)) : null;
    return {
      titulo: 'Hora de sair para o ponto',
      corpo:
        `${linha} chega ao ponto ${alerta.nomeParada} em cerca de ${eta} min.` +
        (aPe ? ` Você leva uns ${aPe} min a pé.` : ''),
    };
  }
  return {
    titulo: eta <= 1 ? 'Seu ônibus está chegando' : `Seu ônibus chega em ${eta} min`,
    corpo: `${linha} está chegando ao ponto ${alerta.nomeParada}.`,
  };
}

function disparar(titulo: string, corpo: string, codigoParada: number) {
  notificarAgora({ titulo, corpo, dados: { codigoParada } });
  if (AppState.currentState === 'active') Alert.alert(titulo, corpo);
}

export function AlertasProvider({ children }: { children: ReactNode }) {
  const { posicao } = useLocalizacao();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<EstadoPermissao>('pendente');

  // Refs: timers e callbacks assíncronos precisam ler o valor mais recente.
  const alertasRef = useRef(alertas);
  const posicaoRef = useRef(posicao);
  useEffect(() => {
    alertasRef.current = alertas;
  }, [alertas]);
  useEffect(() => {
    posicaoRef.current = posicao;
  }, [posicao]);

  useEffect(() => {
    estadoPermissaoNotificacoes().then(setPermissaoNotificacao);
  }, []);

  const atualizar = useCallback((id: string, mudancas: Partial<AlertaOnibus> | Partial<AlertaDescida>) => {
    setAlertas((lista) => lista.map((a) => (a.id === id ? ({ ...a, ...mudancas } as Alerta) : a)));
  }, []);

  const verificarOnibus = useCallback(
    async (alerta: AlertaOnibus) => {
      if (Date.now() - alerta.criadoEm > VALIDADE_ALERTA_MS) {
        cancelarNotificacao(alerta.idAgendada);
        atualizar(alerta.id, { status: 'expirado', idAgendada: undefined });
        return;
      }

      // A notificação agendada já tocou: não avisa de novo.
      if (alerta.agendadaPara && alerta.agendadaPara <= Date.now()) {
        atualizar(alerta.id, { status: 'disparado', idAgendada: undefined, mensagem: 'Aviso entregue pela notificação agendada.' });
        return;
      }

      try {
        const previsao = await olhoVivo.previsaoDaLinhaNaParada(alerta.codigoParada, alerta.codigoLinha);
        if (!estaAtivo(alertasRef.current, alerta.id)) return;

        const linha = previsao.p?.l.find((l) => l.cl === alerta.codigoLinha) ?? previsao.p?.l[0];
        const etas = (linha?.vs ?? []).map((v) => minutosAteChegada(v.t, previsao.hr)).sort((a, b) => a - b);
        const eta = etas[0] ?? null;
        const agora = Date.now();

        if (eta === null) {
          cancelarNotificacao(alerta.idAgendada);
          atualizar(alerta.id, { etaMin: null, ultimaConsulta: agora, erro: undefined, idAgendada: undefined, agendadaPara: undefined });
          return;
        }

        const posicaoAtual = posicaoRef.current;
        const antecedencia = antecedenciaEfetiva(alerta, posicaoAtual);

        if (eta <= antecedencia) {
          cancelarNotificacao(alerta.idAgendada);
          const { titulo, corpo } = textosDoAviso(alerta, eta, posicaoAtual);
          disparar(titulo, corpo, alerta.codigoParada);
          atualizar(alerta.id, { status: 'disparado', etaMin: eta, ultimaConsulta: agora, mensagem: corpo, idAgendada: undefined });
          return;
        }

        // Reagenda a notificação a cada consulta, com a previsão mais recente.
        const quando = agora + (eta - antecedencia) * 60_000;
        await cancelarNotificacao(alerta.idAgendada);
        const { titulo, corpo } = textosDoAviso(alerta, antecedencia, posicaoAtual);
        const idAgendada = await agendarNotificacao(
          { titulo, corpo, dados: { codigoParada: alerta.codigoParada } },
          new Date(quando)
        );
        if (!estaAtivo(alertasRef.current, alerta.id)) {
          cancelarNotificacao(idAgendada);
          return;
        }
        atualizar(alerta.id, { etaMin: eta, ultimaConsulta: agora, erro: undefined, idAgendada, agendadaPara: quando });
      } catch (erro) {
        atualizar(alerta.id, { erro: mensagemDeErro(erro) });
      }
    },
    [atualizar]
  );

  const verificarTodos = useCallback(() => {
    for (const alerta of alertasRef.current) {
      if (alerta.tipo === 'onibus' && alerta.status === 'ativo') verificarOnibus(alerta);
    }
  }, [verificarOnibus]);

  const haOnibusAtivo = alertas.some((a) => a.tipo === 'onibus' && a.status === 'ativo');

  useEffect(() => {
    if (!haOnibusAtivo) return;
    const timer = setInterval(verificarTodos, INTERVALO_CONSULTA_MS);
    return () => clearInterval(timer);
  }, [haOnibusAtivo, verificarTodos]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') return;
      const agora = Date.now();
      for (const alerta of alertasRef.current) {
        if (alerta.tipo === 'onibus' && alerta.status === 'ativo' && alerta.agendadaPara && alerta.agendadaPara <= agora) {
          atualizar(alerta.id, { status: 'disparado', idAgendada: undefined, mensagem: 'Aviso entregue com o app em segundo plano.' });
        }
      }
      setTimeout(verificarTodos, 0);
      estadoPermissaoNotificacoes().then(setPermissaoNotificacao);
    });
    return () => sub.remove();
  }, [atualizar, verificarTodos]);

  useEffect(() => {
    if (!posicao) return;
    for (const alerta of alertasRef.current) {
      if (alerta.tipo !== 'descida' || alerta.status !== 'ativo') continue;
      const distancia = distanciaEmMetros(posicao, alerta.coordParada);
      if (distancia <= RAIO_DESCIDA_M) {
        const titulo = 'Prepare-se para descer';
        const corpo = `Você está a ${formatarDistancia(distancia)} do ponto ${alerta.nomeParada}. Dê o sinal para o motorista.`;
        disparar(titulo, corpo, alerta.codigoParada);
        atualizar(alerta.id, { status: 'disparado', distanciaAtual: distancia, mensagem: corpo });
      } else {
        atualizar(alerta.id, { distanciaAtual: distancia });
      }
    }
  }, [posicao, atualizar]);

  const garantirPermissaoNotificacao = useCallback(async () => {
    const estado = await pedirPermissaoNotificacoes();
    setPermissaoNotificacao(estado);
    return estado;
  }, []);

  const removerAlerta = useCallback((id: string) => {
    const alerta = alertasRef.current.find((a) => a.id === id);
    if (alerta?.tipo === 'onibus') cancelarNotificacao(alerta.idAgendada);
    setAlertas((lista) => lista.filter((a) => a.id !== id));
  }, []);

  const criarAlertaOnibus = useCallback(
    (dados: NovoAlertaOnibus) => {
      const repetido = alertasRef.current.find(
        (a) => a.tipo === 'onibus' && a.status === 'ativo' && a.codigoParada === dados.codigoParada && a.codigoLinha === dados.codigoLinha
      );
      if (repetido) removerAlerta(repetido.id);

      const alerta: AlertaOnibus = { ...dados, id: novoId(), tipo: 'onibus', criadoEm: Date.now(), status: 'ativo', etaMin: null };
      alertasRef.current = [alerta, ...alertasRef.current.filter((a) => a.id !== repetido?.id)];
      setAlertas((lista) => [alerta, ...lista.filter((a) => a.id !== repetido?.id)]);
      verificarOnibus(alerta);
    },
    [removerAlerta, verificarOnibus]
  );

  const criarAlertaDescida = useCallback(
    (dados: NovoAlertaDescida) => {
      const repetido = alertasRef.current.find((a) => a.tipo === 'descida' && a.status === 'ativo');
      if (repetido) removerAlerta(repetido.id);

      const atual = posicaoRef.current;
      const alerta: AlertaDescida = {
        ...dados,
        id: novoId(),
        tipo: 'descida',
        criadoEm: Date.now(),
        status: 'ativo',
        distanciaAtual: atual ? distanciaEmMetros(atual, dados.coordParada) : null,
      };
      alertasRef.current = [alerta, ...alertasRef.current.filter((a) => a.id !== repetido?.id)];
      setAlertas((lista) => [alerta, ...lista.filter((a) => a.id !== repetido?.id)]);
    },
    [removerAlerta]
  );

  const limparConcluidos = useCallback(() => {
    setAlertas((lista) => lista.filter((a) => a.status === 'ativo'));
  }, []);

  const valor: ValorContexto = {
    alertas,
    permissaoNotificacao,
    garantirPermissaoNotificacao,
    criarAlertaOnibus,
    criarAlertaDescida,
    removerAlerta,
    limparConcluidos,
  };

  return <AlertasContext.Provider value={valor}>{children}</AlertasContext.Provider>;
}

export function useAlertas() {
  const contexto = useContext(AlertasContext);
  if (!contexto) throw new Error('useAlertas precisa estar dentro de <AlertasProvider>');
  return contexto;
}
