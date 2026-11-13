import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { CreditoSPTrans, Esqueleto, EstadoMensagem, Faixa, Letreiro } from '@/components/ui';
import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { RAIO_DESCIDA_M, useAlertas, type AlertaDescida } from '@/context/AlertasContext';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import { useConsulta } from '@/hooks/useConsulta';
import { olhoVivo, type Parada } from '@/services/olhovivo';
import { coordDaApi, distanciaEmMetros, formatarDistancia } from '@/utils/geo';

const ATUALIZAR_POSICOES_MS = 20_000;

export default function TelaLinha() {
  const params = useLocalSearchParams<{ codigo: string; letreiro?: string; destino?: string }>();
  const codigo = Number(params.codigo);
  const { posicao } = useLocalizacao();
  const { alertas, criarAlertaDescida, removerAlerta, garantirPermissaoNotificacao } = useAlertas();
  const mapa = useRef<MapView>(null);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const lista = useRef<FlatList<Parada>>(null);

  const paradas = useConsulta(() => olhoVivo.paradasDaLinha(codigo));
  const posicoes = useConsulta(() => olhoVivo.posicaoDaLinha(codigo), ATUALIZAR_POSICOES_MS);

  const pontos = paradas.dados ?? [];
  const onibus = posicoes.dados?.vs ?? [];

  const maisPerto = posicao && pontos.length
    ? pontos.reduce((melhor, p) =>
        distanciaEmMetros(posicao, coordDaApi(p)) < distanciaEmMetros(posicao, coordDaApi(melhor)) ? p : melhor
      )
    : null;

  useEffect(() => {
    const trajeto = paradas.dados;
    if (!trajeto || trajeto.length < 2) return;
    mapa.current?.fitToCoordinates(trajeto.map(coordDaApi), {
      edgePadding: { top: 72, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  }, [paradas.dados]);

  const descidaAtiva = alertas.find((a): a is AlertaDescida => a.tipo === 'descida' && a.status === 'ativo');

  const alternarDescida = async (parada: Parada) => {
    if (descidaAtiva?.codigoParada === parada.cp) {
      removerAlerta(descidaAtiva.id);
      return;
    }
    const permissao = await garantirPermissaoNotificacao();
    criarAlertaDescida({
      codigoParada: parada.cp,
      nomeParada: parada.np || `Ponto ${parada.cp}`,
      coordParada: coordDaApi(parada),
      letreiro: params.letreiro,
    });
    Alert.alert(
      'Alerta de descida ligado',
      `Vamos vibrar e avisar quando você estiver a ${RAIO_DESCIDA_M} m de ${parada.np || 'o ponto'}. Deixe o app aberto durante a viagem.` +
        (permissao !== 'concedida' ? '\n\nAs notificações estão desligadas: o aviso será só na tela, com vibração.' : '')
    );
  };

  const focarPonto = (parada: Parada, indice: number) => {
    setSelecionada(parada.cp);
    mapa.current?.animateToRegion({ ...coordDaApi(parada), latitudeDelta: 0.008, longitudeDelta: 0.008 }, 300);
    lista.current?.scrollToIndex({ index: indice, viewPosition: 0.3, animated: true });
  };

  const titulo = params.letreiro ?? 'Linha';

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: titulo }} />

      <View style={estilos.areaMapa}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
          showsUserLocation
          showsMyLocationButton
          toolbarEnabled={false}>
          {pontos.length > 1 ? (
            <Polyline coordinates={pontos.map(coordDaApi)} strokeColor={Cores.primaria} strokeWidth={3} />
          ) : null}
          {pontos.map((p, i) => (
            <Marker
              key={p.cp}
              coordinate={coordDaApi(p)}
              title={p.np}
              description={p.ed}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => focarPonto(p, i)}>
              <View
                style={[
                  estilos.marcadorPonto,
                  (p.cp === selecionada || p.cp === descidaAtiva?.codigoParada) && estilos.marcadorPontoAtivo,
                ]}
              />
            </Marker>
          ))}
          {onibus.map((v) => (
            <Marker
              key={v.p}
              coordinate={coordDaApi(v)}
              title={`Ônibus ${v.p}`}
              description={v.a ? 'Veículo acessível' : undefined}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={estilos.marcadorOnibus}>
                <Ionicons name="bus" size={16} color={Cores.primariaTexto} />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={estilos.legenda} pointerEvents="none">
          <Letreiro texto={titulo} />
          <Text style={estilos.legendaTexto} numberOfLines={1}>
            {params.destino ? `${params.destino} · ` : ''}
            {posicoes.dados ? `${onibus.length} ônibus agora` : 'buscando ônibus...'}
          </Text>
        </View>
      </View>

      <FlatList
        ref={lista}
        data={pontos}
        keyExtractor={(p) => String(p.cp)}
        contentContainerStyle={estilos.conteudo}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <View style={{ gap: Espaco.sm, marginBottom: Espaco.sm }}>
            {posicoes.erro ? <Faixa tom="erro" texto={posicoes.erro} /> : null}
            {descidaAtiva ? (
              <Faixa
                icone="notifications"
                texto={`Descida em ${descidaAtiva.nomeParada}${descidaAtiva.distanciaAtual !== null ? ` · faltam ${formatarDistancia(descidaAtiva.distanciaAtual)}` : ''}`}
              />
            ) : pontos.length ? (
              <Text style={estilos.dica}>Toque no sino do ponto onde você vai descer para ser avisado na hora certa.</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          paradas.carregando ? (
            <Esqueleto linhas={4} />
          ) : (
            <EstadoMensagem
              icone="git-commit-outline"
              tom={paradas.erro ? 'erro' : 'neutro'}
              titulo={paradas.erro ? 'Não deu para carregar os pontos' : 'Sem pontos cadastrados'}
              texto={paradas.erro ?? 'A SPTrans não informou os pontos desta linha.'}
              acao={paradas.erro ? { titulo: 'Tentar de novo', onPress: paradas.recarregar } : undefined}
            />
          )
        }
        ListFooterComponent={<CreditoSPTrans hora={posicoes.dados?.hr} />}
        renderItem={({ item, index }) => (
          <ItemPonto
            parada={item}
            ordem={index + 1}
            ultimo={index === pontos.length - 1}
            distancia={posicao ? distanciaEmMetros(posicao, coordDaApi(item)) : null}
            maisPerto={item.cp === maisPerto?.cp}
            selecionado={item.cp === selecionada}
            descida={item.cp === descidaAtiva?.codigoParada}
            onFocar={() => focarPonto(item, index)}
            onDescida={() => alternarDescida(item)}
            onPrevisao={() =>
              router.push({
                pathname: '/parada/[codigo]',
                params: { codigo: String(item.cp), nome: item.np, py: String(item.py), px: String(item.px) },
              })
            }
          />
        )}
      />
    </View>
  );
}

type ItemPontoProps = {
  parada: Parada;
  ordem: number;
  ultimo: boolean;
  distancia: number | null;
  maisPerto: boolean;
  selecionado: boolean;
  descida: boolean;
  onFocar: () => void;
  onDescida: () => void;
  onPrevisao: () => void;
};

function ItemPonto({ parada, ordem, ultimo, distancia, maisPerto, selecionado, descida, onFocar, onDescida, onPrevisao }: ItemPontoProps) {
  return (
    <View style={[estilos.item, selecionado && { backgroundColor: Cores.primariaClara }]}>
      <View style={estilos.trilho}>
        <View style={[estilos.trilhoLinha, ordem === 1 && { top: '50%' }, ultimo && { bottom: '50%' }]} />
        <View style={[estilos.trilhoPonto, descida && estilos.trilhoPontoAtivo]} />
      </View>

      <Pressable
        style={{ flex: 1, paddingVertical: Espaco.md }}
        onPress={onFocar}
        accessibilityRole="button"
        accessibilityLabel={`Mostrar ${parada.np} no mapa`}>
        <Text style={estilos.nome} numberOfLines={1}>
          {parada.np || `Ponto ${parada.cp}`}
        </Text>
        <Text style={estilos.detalhe} numberOfLines={1}>
          {maisPerto ? 'Mais perto de você · ' : ''}
          {distancia !== null ? formatarDistancia(distancia) : parada.ed}
        </Text>
      </Pressable>

      <Pressable
        onPress={onPrevisao}
        style={estilos.botaoIcone}
        accessibilityRole="button"
        accessibilityLabel={`Próximos ônibus em ${parada.np}`}>
        <Ionicons name="time-outline" size={22} color={Cores.primaria} />
      </Pressable>
      <Pressable
        onPress={onDescida}
        style={[estilos.botaoIcone, descida && estilos.botaoIconeAtivo]}
        accessibilityRole="button"
        accessibilityLabel={descida ? `Cancelar alerta de descida em ${parada.np}` : `Avisar quando chegar em ${parada.np}`}>
        <Ionicons
          name={descida ? 'notifications' : 'notifications-outline'}
          size={22}
          color={descida ? Cores.primariaTexto : Cores.primaria}
        />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  areaMapa: {
    height: '45%',
  },
  legenda: {
    position: 'absolute',
    left: Espaco.md,
    right: Espaco.md + ALVO_TOQUE + Espaco.sm,
    top: Espaco.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    backgroundColor: Cores.superficie,
    borderRadius: Raio.md,
    padding: Espaco.sm,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  legendaTexto: {
    flex: 1,
    fontSize: Fonte.pequena + 1,
    color: Cores.texto,
  },
  marcadorPonto: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Cores.superficie,
    borderWidth: 3,
    borderColor: Cores.primaria,
  },
  marcadorPontoAtivo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Cores.alerta,
    borderColor: Cores.superficie,
  },
  marcadorOnibus: {
    backgroundColor: Cores.texto,
    borderRadius: Raio.pill,
    padding: Espaco.xs + 1,
    borderWidth: 2,
    borderColor: Cores.superficie,
  },
  conteudo: {
    padding: Espaco.lg,
    flexGrow: 1,
  },
  dica: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    paddingRight: Espaco.xs,
    borderRadius: Raio.md,
  },
  trilho: {
    width: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trilhoLinha: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Cores.primaria,
  },
  trilhoPonto: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Cores.superficie,
    borderWidth: 3,
    borderColor: Cores.primaria,
  },
  trilhoPontoAtivo: {
    backgroundColor: Cores.alerta,
    borderColor: Cores.alerta,
  },
  nome: {
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
  },
  detalhe: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
  botaoIcone: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoIconeAtivo: {
    backgroundColor: Cores.primaria,
    borderColor: Cores.primaria,
  },
});
