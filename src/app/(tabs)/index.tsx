import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Chegadas } from '@/components/Chegadas';
import { PermissaoGps } from '@/components/PermissaoGps';
import { CreditoSPTrans, Esqueleto, EstadoMensagem, Faixa, Letreiro } from '@/components/ui';
import { Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import { mensagemDeErro, olhoVivo, type Previsao } from '@/services/olhovivo';
import { buscarParadasProximas, type ParadaComDistancia } from '@/services/paradasProximas';
import { distanciaEmMetros, formatarDistancia, minutosAPe, type Coordenada } from '@/utils/geo';

const DISTANCIA_PARA_NOVA_BUSCA_M = 200;
const PONTOS_COM_PREVISAO = 6;

export default function PertoDeMim() {
  const { estado, posicao, precisao } = useLocalizacao();
  const [paradas, setParadas] = useState<ParadaComDistancia[] | null>(null);
  const [previsoes, setPrevisoes] = useState<Record<number, Previsao>>({});
  const [ruas, setRuas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ultimaBusca = useRef<Coordenada | null>(null);

  const buscar = useCallback(async (centro: Coordenada) => {
    ultimaBusca.current = centro;
    setBuscando(true);
    setErro(null);
    try {
      const resultado = await buscarParadasProximas(centro);
      setParadas(resultado.paradas);
      setRuas(resultado.ruas);

      const respostas = await Promise.allSettled(
        resultado.paradas.slice(0, PONTOS_COM_PREVISAO).map((p) => olhoVivo.previsaoDaParada(p.cp))
      );
      const mapa: Record<number, Previsao> = {};
      respostas.forEach((r, i) => {
        if (r.status === 'fulfilled') mapa[resultado.paradas[i].cp] = r.value;
      });
      setPrevisoes(mapa);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (!posicao || buscando) return;
    const anterior = ultimaBusca.current;
    if (!anterior || distanciaEmMetros(anterior, posicao) > DISTANCIA_PARA_NOVA_BUSCA_M) {
      buscar(posicao);
    }
  }, [posicao, buscando, buscar]);

  if (estado !== 'ativo' && estado !== 'verificando') {
    return (
      <View style={estilos.tela}>
        <PermissaoGps />
      </View>
    );
  }

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.localAtual}>
        <Ionicons name="navigate" size={18} color={Cores.primaria} />
        <Text style={estilos.localTexto} numberOfLines={2}>
          {posicao
            ? ruas[0]
              ? `Você está perto de ${ruas[0]}`
              : 'Localização encontrada'
            : 'Procurando sua localização...'}
          {precisao && precisao > 100 ? ` (precisão de ${Math.round(precisao)} m)` : ''}
        </Text>
      </View>
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
    </View>
  );

  const vazio = !posicao || (buscando && !paradas) ? (
    <Esqueleto linhas={5} />
  ) : erro ? undefined : (
    <EstadoMensagem
      icone="bus-outline"
      titulo="Nenhum ponto encontrado por perto"
      texto={`Não achamos pontos da SPTrans a até 800 m de você${ruas.length ? ` (procuramos em ${ruas.join(', ')})` : ''}. Tente a aba Buscar com o nome da rua ou do ponto.`}
      acao={{ titulo: 'Buscar ponto', icone: 'search', onPress: () => router.navigate('/buscar') }}
    />
  );

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      data={paradas ?? []}
      keyExtractor={(p) => String(p.cp)}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ListFooterComponent={paradas?.length ? <CreditoSPTrans /> : undefined}
      ItemSeparatorComponent={() => <View style={{ height: Espaco.md }} />}
      refreshControl={
        <RefreshControl
          refreshing={buscando && !!paradas}
          onRefresh={() => {
            if (posicao) buscar(posicao);
          }}
          colors={[Cores.primaria]}
          tintColor={Cores.primaria}
        />
      }
      renderItem={({ item }) => <ItemParada parada={item} previsao={previsoes[item.cp]} />}
    />
  );
}

function ItemParada({ parada, previsao }: { parada: ParadaComDistancia; previsao?: Previsao }) {
  const linhas = previsao?.p?.l ?? [];
  const aPe = minutosAPe(parada.distancia);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ponto ${parada.np}, a ${formatarDistancia(parada.distancia)}, cerca de ${aPe} minutos a pé`}
      onPress={() =>
        router.push({
          pathname: '/parada/[codigo]',
          params: { codigo: String(parada.cp), nome: parada.np, py: String(parada.py), px: String(parada.px) },
        })
      }
      style={({ pressed }) => [estilos.item, pressed && { backgroundColor: Cores.fundo }]}>
      <View style={estilos.itemTopo}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.nome} numberOfLines={1}>
            {parada.np || 'Ponto sem nome'}
          </Text>
          {parada.ed ? (
            <Text style={estilos.endereco} numberOfLines={1}>
              {parada.ed}
            </Text>
          ) : null}
        </View>
        <View style={estilos.distancia}>
          <Text style={estilos.distanciaValor}>{formatarDistancia(parada.distancia)}</Text>
          <Text style={estilos.distanciaPe}>
            <Ionicons name="walk" size={13} /> {aPe} min
          </Text>
        </View>
      </View>

      {linhas.slice(0, 3).map((linha) => (
        <View key={linha.cl} style={estilos.linhaPrevisao}>
          <Letreiro texto={linha.c} />
          <View style={{ flex: 1 }}>
            <Chegadas veiculos={linha.vs} horaConsulta={previsao?.hr ?? ''} maximo={2} />
          </View>
        </View>
      ))}
      {linhas.length > 3 ? <Text style={estilos.mais}>+ {linhas.length - 3} linhas neste ponto</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  conteudo: {
    padding: Espaco.lg,
    flexGrow: 1,
  },
  cabecalho: {
    gap: Espaco.md,
    marginBottom: Espaco.lg,
  },
  localAtual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
  },
  localTexto: {
    flex: 1,
    fontSize: Fonte.normal,
    color: Cores.textoSecundario,
  },
  item: {
    backgroundColor: Cores.superficie,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: Espaco.lg,
    gap: Espaco.md,
  },
  itemTopo: {
    flexDirection: 'row',
    gap: Espaco.md,
  },
  nome: {
    fontSize: Fonte.media,
    fontWeight: '600',
    color: Cores.texto,
  },
  endereco: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
  distancia: {
    alignItems: 'flex-end',
  },
  distanciaValor: {
    fontSize: Fonte.normal,
    fontWeight: '700',
    color: Cores.primaria,
    fontVariant: ['tabular-nums'],
  },
  distanciaPe: {
    fontSize: Fonte.pequena,
    color: Cores.textoSecundario,
  },
  linhaPrevisao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
  },
  mais: {
    fontSize: Fonte.pequena,
    color: Cores.textoSecundario,
  },
});
