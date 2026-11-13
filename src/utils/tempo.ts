function emMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Usa a hora da API (hr), não a do celular, e trata a virada da meia-noite.
export function minutosAteChegada(horaPrevista: string, horaConsulta: string) {
  const diferenca = (emMinutos(horaPrevista) - emMinutos(horaConsulta) + 1440) % 1440;
  return diferenca > 720 ? 0 : diferenca;
}

export function formatarMinutos(minutos: number) {
  if (minutos <= 0) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function horaAtual() {
  const agora = new Date();
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}
