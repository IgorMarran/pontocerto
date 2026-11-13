import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import type { VeiculoPrevisao } from '@/services/olhovivo';
import { formatarMinutos, minutosAteChegada } from '@/utils/tempo';

type Props = {
  veiculos: VeiculoPrevisao[];
  horaConsulta: string;
  maximo?: number;
};

export function minutosDosVeiculos(veiculos: VeiculoPrevisao[], horaConsulta: string) {
  return veiculos
    .map((v) => ({ ...v, minutos: minutosAteChegada(v.t, horaConsulta) }))
    .sort((a, b) => a.minutos - b.minutos);
}

export function Chegadas({ veiculos, horaConsulta, maximo = 3 }: Props) {
  const proximos = minutosDosVeiculos(veiculos, horaConsulta).slice(0, maximo);

  if (proximos.length === 0) {
    return <Text style={estilos.semPrevisao}>Sem previsão agora</Text>;
  }

  return (
    <View style={estilos.linha}>
      {proximos.map((v, i) => (
        <View
          key={`${v.p}-${i}`}
          style={[estilos.chip, i === 0 && estilos.chipPrimeiro]}
          accessibilityLabel={`Chega ${v.minutos <= 0 ? 'agora' : `em ${v.minutos} minutos`}, às ${v.t}${v.a ? ', veículo acessível' : ''}`}>
          <Text style={[estilos.minutos, i === 0 && estilos.minutosPrimeiro]}>{formatarMinutos(v.minutos)}</Text>
          {v.a ? <Ionicons name="accessibility" size={14} color={i === 0 ? Cores.primariaTexto : Cores.acessivel} /> : null}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.xs + 2,
    borderRadius: Raio.pill,
    backgroundColor: Cores.fundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  chipPrimeiro: {
    backgroundColor: Cores.primaria,
    borderColor: Cores.primaria,
  },
  minutos: {
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
    fontVariant: ['tabular-nums'],
  },
  minutosPrimeiro: {
    color: Cores.primariaTexto,
  },
  semPrevisao: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
});
