// Login por cookie: o fetch do React Native guarda o cookie da sessão.
// Se a sessão expirar (401), o login é refeito uma vez.
const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';
const TOKEN = process.env.EXPO_PUBLIC_OLHOVIVO_TOKEN ?? '';
const TEMPO_LIMITE_MS = 15000;

export type Linha = {
  cl: number;
  lc: boolean;
  lt: string;
  // 1 = terminal principal -> secundário; 2 = volta
  sl: 1 | 2;
  tl: number;
  tp: string;
  ts: string;
};

export type Parada = {
  cp: number;
  np: string;
  ed: string;
  py: number;
  px: number;
};

export type VeiculoPrevisao = {
  p: string | number;
  t: string;
  a: boolean;
  ta: string;
  py: number;
  px: number;
};

export type LinhaPrevisao = {
  c: string;
  cl: number;
  sl: 1 | 2;
  lt0: string;
  lt1: string;
  qv: number;
  vs: VeiculoPrevisao[];
};

export type Previsao = {
  hr: string;
  p: {
    cp: number;
    np: string;
    py: number;
    px: number;
    l: LinhaPrevisao[];
  } | null;
};

export type VeiculoPosicao = {
  p: number;
  a: boolean;
  ta: string;
  py: number;
  px: number;
};

export type PosicaoLinha = {
  hr: string;
  vs: VeiculoPosicao[];
};

export class ErroOlhoVivo extends Error {}

let loginEmAndamento: Promise<void> | null = null;
let autenticado = false;

async function fetchComTempoLimite(url: string, init: RequestInit = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(url, { ...init, credentials: 'include', signal: controle.signal });
  } catch {
    if (controle.signal.aborted) {
      throw new ErroOlhoVivo('A SPTrans demorou para responder. Tente de novo.');
    }
    throw new ErroOlhoVivo('Sem conexão com a internet.');
  } finally {
    clearTimeout(timer);
  }
}

async function fazerLogin() {
  if (!TOKEN) {
    throw new ErroOlhoVivo(
      'Token da SPTrans não configurado. Crie o arquivo .env com EXPO_PUBLIC_OLHOVIVO_TOKEN (veja o README).'
    );
  }
  const resposta = await fetchComTempoLimite(
    `${BASE_URL}/Login/Autenticar?token=${encodeURIComponent(TOKEN)}`,
    { method: 'POST', body: '' }
  );
  const ok = resposta.ok && (await resposta.json()) === true;
  if (!ok) {
    throw new ErroOlhoVivo('A SPTrans recusou o token. Confira o EXPO_PUBLIC_OLHOVIVO_TOKEN no .env.');
  }
  autenticado = true;
}

function garantirLogin(forcar = false) {
  if (forcar) autenticado = false;
  if (autenticado) return Promise.resolve();
  if (!loginEmAndamento) {
    loginEmAndamento = fazerLogin().finally(() => {
      loginEmAndamento = null;
    });
  }
  return loginEmAndamento;
}

async function get<T>(caminho: string, tentativa = 0): Promise<T> {
  await garantirLogin();
  const resposta = await fetchComTempoLimite(`${BASE_URL}${caminho}`);

  if (resposta.status === 401 && tentativa === 0) {
    await garantirLogin(true);
    return get<T>(caminho, 1);
  }
  if (!resposta.ok) {
    throw new ErroOlhoVivo(`A SPTrans respondeu com erro (${resposta.status}).`);
  }
  return (await resposta.json()) as T;
}

const q = encodeURIComponent;

export const olhoVivo = {
  buscarLinhas: (termo: string) => get<Linha[]>(`/Linha/Buscar?termosBusca=${q(termo)}`),

  buscarParadas: (termo: string) => get<Parada[]>(`/Parada/Buscar?termosBusca=${q(termo)}`),

  paradasDaLinha: (codigoLinha: number) =>
    get<Parada[]>(`/Parada/BuscarParadasPorLinha?codigoLinha=${codigoLinha}`),

  posicaoDaLinha: (codigoLinha: number) =>
    get<PosicaoLinha>(`/Posicao/Linha?codigoLinha=${codigoLinha}`),

  previsaoDaParada: (codigoParada: number) =>
    get<Previsao>(`/Previsao/Parada?codigoParada=${codigoParada}`),

  previsaoDaLinhaNaParada: (codigoParada: number, codigoLinha: number) =>
    get<Previsao>(`/Previsao?codigoParada=${codigoParada}&codigoLinha=${codigoLinha}`),
};

export function letreiroDaLinha(linha: Linha) {
  return `${linha.lt}-${linha.tl}`;
}

export function destinoDaLinha(linha: Linha) {
  return linha.sl === 1 ? linha.ts : linha.tp;
}

export function destinoDaPrevisao(linha: LinhaPrevisao) {
  return linha.sl === 1 ? linha.lt1 : linha.lt0;
}

export function mensagemDeErro(erro: unknown) {
  if (erro instanceof ErroOlhoVivo) return erro.message;
  return 'Algo deu errado ao falar com a SPTrans.';
}
