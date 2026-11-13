export type Coordenada = { latitude: number; longitude: number };

const RAIO_TERRA_M = 6371000;
const METROS_POR_MINUTO_A_PE = 80;
const FATOR_RUAS = 1.3;

const rad = (graus: number) => (graus * Math.PI) / 180;

export function distanciaEmMetros(a: Coordenada, b: Coordenada) {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
}

export function minutosAPe(metros: number) {
  return Math.max(1, Math.ceil((metros * FATOR_RUAS) / METROS_POR_MINUTO_A_PE));
}

export function deslocar(ponto: Coordenada, metrosNorte: number, metrosLeste: number): Coordenada {
  const dLat = metrosNorte / RAIO_TERRA_M;
  const dLon = metrosLeste / (RAIO_TERRA_M * Math.cos(rad(ponto.latitude)));
  return {
    latitude: ponto.latitude + (dLat * 180) / Math.PI,
    longitude: ponto.longitude + (dLon * 180) / Math.PI,
  };
}

export function formatarDistancia(metros: number) {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

export function coordDaApi(item: { py: number; px: number }): Coordenada {
  return { latitude: item.py, longitude: item.px };
}
