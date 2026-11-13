import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Chegadas, minutosDosVeiculos } from '@/components/Chegadas';
import { ModalNovoAlerta, type AlvoAlerta } from '@/components/ModalNovoAlerta';
import { CreditoSPTrans, Esqueleto, EstadoMensagem, Faixa, Letreiro } from '@/components/ui';
import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { useAlertas } from '@/context/AlertasContext';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import { useConsulta } from '@/hooks/useConsulta';
import { destinoDaPrevisao, olhoVivo, type LinhaPrevisao } from '@/services/olhovivo';
import { coordDaApi, distanciaEmMetros, formatarDistancia, minutosAPe, type Coordenada } from '@/utils/geo';

const ATUALIZAR_A_CADA_MS = 30_000;

export default function TelaParada() {
  const params = useLocalSearchParams<{ codigo: string; nome?: string; py?: string; px?: string }>();
  const codigo = Number(params.codigo);
  const { posicao } = useLocalizacao();
  const { alertas } = useAlertas();
  const [alvo, setAlvo] = useState<AlvoAlerta | null>(null);

  const { dados, erro, carregando, atualizando, recarregar } = useConsulta(
    () => olhoVivo.previsaoDaParada(codigo),
    ATUALIZAR_A_CADA_MS
  );

  const ponto = dados?.p;
  const nome = ponto?.np || params.nome || `Ponto ${codigo}`;
  const coord: Coordenada | null = ponto
    ? coordDaApi(ponto)
    : params.py && params.px
      ? { latitude: Number(params.py), longitude: Number(params.px) }
      : null;

  const linhas = [...(ponto?.l ?? [])].sort((a, b) => primeiraChegada(a, dados!.hr) - primeiraChegada(b, dados!.hr));
  const distancia = posicao && coord ? distanciaEmMetros(posicao, coord) : null;

  const alertaAtivo = (linha: LinhaPrevisao) =>
    alertas.some(
      (a) => a.tipo === 'onibus' && a.status === 'ativo' && a.codigoParada === codigo && a.codigoLinha === linha.cl
    );

  const cabecalho = (
    <View style={{ gap: Espaco.md, marginBottom: Espaco.md }}>
      {coord ? (
        <MapView
          style={estilos.mapa}
          initialRegion={{ ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          showsUserLocation
          showsMyLocationButton
          toolbarEnabled={false}>
          <Marker coordinate={coord} title={nome} pinColor={Cores.primaria} />
          {linhas.flatMap((linha) =>
            linha.vs.map((v) => (
              <Marker
                key={`${linha.cl}-${v.p}`}
                coordinate={coordDaApi(v)}
                title={`${linha.c} · chega às ${v.t}`}
                description={v.a ? 'Veículo acessível' : undefined}>
                <View style={estilos.marcadorOnibus}>
                  <Ionicons name="bus" size={14} color={Cores.primariaTexto} />
                </View>
              </Marker>
            ))
          )}
        </MapView>
      ) : null}

      <View style={estilos.resumo}>
        <Ionicons name="walk" size={20} color={Cores.primaria} />
        <Text style={estilos.resumoTexto}>
          {distancia === null
            ? 'Ligue o GPS para ver a distância até o ponto.'
            : distancia < 60
              ? 'Você está no ponto.'
              : `Você está a ${formatarDistancia(distancia)} · cerca de ${minutosAPe(distancia)} min a pé`}
        </Text>
      </View>

      {erro && dados ? <Faixa tom="erro" texto={`${erro} Mostrando a última previsão.`} /> : null}
      {linhas.length > 0 ? <Text style={estilos.secao}>Próximos ônibus</Text> : null}
    </View>
  );

  const vazio = carregando ? (
    <Esqueleto linhas={4} />
  ) : erro ? (
    <EstadoMensagem icone="cloud-offline-outline" tom="erro" titulo="Não deu para carregar a previsão" texto={erro} acao={{ titulo: 'Tentar de novo', onPress: recarregar }} />
  ) : (
    <EstadoMensagem
      icone="time-outline"
      titulo="Nenhum ônibus previsto agora"
      texto="A SPTrans não tem previsão de chegada para este ponto no momento. A tela atualiza sozinha a cada 30 segundos."
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: nome }} />
      <FlatList
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        data={linhas}
        keyExtractor={(l) => String(l.cl)}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={vazio}
        ListFooterComponent={<CreditoSPTrans hora={dados?.hr} />}
        ItemSeparatorComponent={() => <View style={{ height: Espaco.sm }} />}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={recarregar} colors={[Cores.primaria]} tintColor={Cores.primaria} />
        }
        renderItem={({ item }) => (
          <ItemLinha
            linha={item}
            horaConsulta={dados!.hr}
            comAlerta={alertaAtivo(item)}
            onAlertar={() =>
              coord &&
              setAlvo({
                codigoParada: codigo,
                nomeParada: nome,
                coordParada: coord,
                codigoLinha: item.cl,
                letreiro: item.c,
                destino: destinoDaPrevisao(item),
              })
            }
            onVerMapa={() =>
              router.push({
                pathname: '/linha/[codigo]',
                params: { codigo: String(item.cl), letreiro: item.c, destino: destinoDaPrevisao(item) },
              })
            }
          />
        )}
      />
      <ModalNovoAlerta alvo={alvo} onFechar={() => setAlvo(null)} />
    </>
  );
}

function primeiraChegada(linha: LinhaPrevisao, hora: string) {
  return minutosDosVeiculos(linha.vs, hora)[0]?.minutos ?? Infinity;
}

type ItemLinhaProps = {
  linha: LinhaPrevisao;
  horaConsulta: string;
  comAlerta: boolean;
  onAlertar: () => void;
  onVerMapa: () => void;
};

function ItemLinha({ linha, horaConsulta, comAlerta, onAlertar, onVerMapa }: ItemLinhaProps) {
  const destino = destinoDaPrevisao(linha);
  return (
    <View style={estilos.item}>
      <View style={estilos.itemTopo}>
        <Letreiro texto={linha.c} />
        <Text style={estilos.destino} numberOfLines={1}>
          {destino}
        </Text>
      </View>
      <View style={estilos.itemBase}>
        <View style={{ flex: 1 }}>
          <Chegadas veiculos={linha.vs} horaConsulta={horaConsulta} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver linha ${linha.c} no mapa`}
          onPress={onVerMapa}
          style={estilos.botaoIcone}>
          <Ionicons name="map-outline" size={22} color={Cores.primaria} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={comAlerta ? `Alerta ativo para ${linha.c}. Trocar alerta` : `Criar alerta para ${linha.c}`}
          onPress={onAlertar}
          style={[estilos.botaoIcone, comAlerta && estilos.botaoIconeAtivo]}>
          <Ionicons
            name={comAlerta ? 'notifications' : 'notifications-outline'}
            size={22}
            color={comAlerta ? Cores.primariaTexto : Cores.primaria}
          />
        </Pressable>
      </View>
    </View>
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
  mapa: {
    height: 220,
    borderRadius: Raio.lg,
    overflow: 'hidden',
  },
  marcadorOnibus: {
    backgroundColor: Cores.primaria,
    borderRadius: Raio.pill,
    padding: Espaco.xs + 1,
    borderWidth: 2,
    borderColor: Cores.superficie,
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
  },
  resumoTexto: {
    flex: 1,
    fontSize: Fonte.normal,
    color: Cores.texto,
  },
  secao: {
    fontSize: Fonte.pequena,
    fontWeight: '600',
    color: Cores.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Espaco.sm,
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
    alignItems: 'center',
    gap: Espaco.md,
  },
  destino: {
    flex: 1,
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
  },
  itemBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
  },
  botaoIcone: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoIconeAtivo: {
    backgroundColor: Cores.primaria,
    borderColor: Cores.primaria,
  },
});
