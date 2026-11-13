// A API não busca pontos por coordenada. Então descobrimos pelo GPS os nomes
// das ruas ao redor, buscamos os pontos delas e ordenamos pela distância.
import * as Location from 'expo-location';

import { olhoVivo, type Parada } from '@/services/olhovivo';
import { coordDaApi, deslocar, distanciaEmMetros, type Coordenada } from '@/utils/geo';

export type ParadaComDistancia = Parada & { distancia: number };

const RAIO_BUSCA_M = 800;
const MAXIMO_RESULTADOS = 15;
const DESLOCAMENTO_AMOSTRA_M = 250;

// A SPTrans abrevia tipo de rua e títulos ("AV", "R", "DR"): buscamos só pelo nome.
const PREFIXOS = new Set([
  'RUA', 'R', 'AVENIDA', 'AV', 'ALAMEDA', 'AL', 'PRACA', 'PCA', 'ESTRADA', 'ESTR', 'EST',
  'TRAVESSA', 'TV', 'VIADUTO', 'VD', 'LARGO', 'LGO', 'RODOVIA', 'ROD', 'VIELA', 'PASSAGEM',
  'PONTE', 'VIA', 'ACESSO', 'COMPLEXO', 'PARQUE',
  'DOUTOR', 'DR', 'DOUTORA', 'DRA', 'PROFESSOR', 'PROF', 'PROFESSORA', 'PROFA', 'ENGENHEIRO',
  'ENG', 'GENERAL', 'GAL', 'CORONEL', 'CEL', 'PADRE', 'PE', 'PRESIDENTE', 'PRES', 'SENADOR',
  'SEN', 'DEPUTADO', 'DEP', 'MARECHAL', 'MAL', 'BRIGADEIRO', 'BRIG', 'DOM', 'DONA', 'MAJOR',
  'CAPITAO', 'CAP', 'TENENTE', 'TEN', 'COMENDADOR', 'COM', 'VEREADOR', 'VER', 'GOVERNADOR',
  'GOV', 'PREFEITO', 'MINISTRO', 'MIN', 'ALMIRANTE', 'DESEMBARGADOR', 'DES', 'CONSELHEIRO',
  'CONS', 'MAESTRO', 'DE', 'DA', 'DO', 'DOS', 'DAS',
]);

function semAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function termoDeBusca(rua: string): string | null {
  const palavras = semAcentos(rua)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  while (palavras.length > 1 && PREFIXOS.has(palavras[0])) palavras.shift();

  const termo = palavras.join(' ');
  return termo.length >= 2 ? termo : null;
}

function termoAlternativo(termo: string) {
  const maisLonga = termo.split(' ').reduce((a, b) => (b.length > a.length ? b : a), '');
  return maisLonga.length >= 5 && maisLonga !== termo ? maisLonga : null;
}

async function ruasAoRedor(centro: Coordenada) {
  const d = DESLOCAMENTO_AMOSTRA_M;
  const amostras = [
    centro,
    deslocar(centro, d, 0),
    deslocar(centro, -d, 0),
    deslocar(centro, 0, d),
    deslocar(centro, 0, -d),
  ];

  const ruas: string[] = [];
  for (const ponto of amostras) {
    try {
      const [endereco] = await Location.reverseGeocodeAsync(ponto);
      if (endereco?.street) ruas.push(endereco.street);
    } catch {
      // Uma amostra que falha não impede as outras.
    }
  }
  return ruas;
}

async function buscarComAlternativa(termo: string) {
  const paradas = await olhoVivo.buscarParadas(termo);
  if (paradas.length > 0) return paradas;
  const alternativo = termoAlternativo(termo);
  return alternativo ? olhoVivo.buscarParadas(alternativo) : [];
}

export async function buscarParadasProximas(posicao: Coordenada) {
  const ruas = await ruasAoRedor(posicao);
  const termos = [...new Set(ruas.map(termoDeBusca).filter((t): t is string => t !== null))];

  const respostas = await Promise.allSettled(termos.map(buscarComAlternativa));

  const falhas = respostas.filter((r) => r.status === 'rejected');
  if (termos.length > 0 && falhas.length === termos.length) {
    throw (falhas[0] as PromiseRejectedResult).reason;
  }

  const porCodigo = new Map<number, ParadaComDistancia>();
  for (const resposta of respostas) {
    if (resposta.status !== 'fulfilled') continue;
    for (const parada of resposta.value) {
      const distancia = distanciaEmMetros(posicao, coordDaApi(parada));
      if (distancia <= RAIO_BUSCA_M) porCodigo.set(parada.cp, { ...parada, distancia });
    }
  }

  const paradas = [...porCodigo.values()]
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, MAXIMO_RESULTADOS);

  return { paradas, ruas: [...new Set(ruas)] };
}
