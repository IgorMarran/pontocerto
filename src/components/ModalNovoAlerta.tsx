import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { MARGEM_SAIR_MIN, useAlertas } from '@/context/AlertasContext';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import { distanciaEmMetros, formatarDistancia, minutosAPe, type Coordenada } from '@/utils/geo';

import { Botao, Letreiro, type NomeIcone } from './ui';

export type AlvoAlerta = {
  codigoParada: number;
  nomeParada: string;
  coordParada: Coordenada;
  codigoLinha: number;
  letreiro: string;
  destino: string;
};

type Escolha = { modo: 'chegada'; minutos: number } | { modo: 'sair' };

const ANTECEDENCIAS = [3, 5, 10];

type Props = {
  alvo: AlvoAlerta | null;
  onFechar: () => void;
};

export function ModalNovoAlerta({ alvo, onFechar }: Props) {
  const { posicao } = useLocalizacao();
  const { criarAlertaOnibus, garantirPermissaoNotificacao } = useAlertas();
  const insets = useSafeAreaInsets();
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [salvando, setSalvando] = useState(false);

  const distancia = alvo && posicao ? distanciaEmMetros(posicao, alvo.coordParada) : null;
  const aPe = distancia !== null ? minutosAPe(distancia) : null;
  const sugestao: Escolha = distancia !== null && distancia > 150 ? { modo: 'sair' } : { modo: 'chegada', minutos: 5 };
  const selecionada = escolha ?? sugestao;

  const fechar = () => {
    setEscolha(null);
    onFechar();
  };

  const confirmar = async () => {
    if (!alvo) return;
    setSalvando(true);
    let permissao: Awaited<ReturnType<typeof garantirPermissaoNotificacao>> = 'negada';
    try {
      permissao = await garantirPermissaoNotificacao();
    } catch {
      // Se o pedido falhar, o alerta funciona só com vibração e aviso na tela.
    }
    criarAlertaOnibus({
      ...alvo,
      modo: selecionada.modo,
      antecedenciaMin: selecionada.modo === 'chegada' ? selecionada.minutos : 5,
    });
    setSalvando(false);
    fechar();
    if (permissao !== 'concedida') {
      Alert.alert(
        'Notificações desligadas',
        'O alerta foi criado, mas sem permissão de notificação o aviso só aparece com o app aberto (com vibração). Você pode liberar as notificações nas configurações do celular.'
      );
    }
  };

  const ehChegada = (min: number) => selecionada.modo === 'chegada' && selecionada.minutos === min;

  return (
    <Modal visible={!!alvo} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable style={estilos.fundo} onPress={fechar} accessibilityLabel="Fechar" />
      <View style={[estilos.folha, { paddingBottom: insets.bottom + Espaco.lg }]}>
        <View style={estilos.alca} />
        {alvo ? (
          <>
            <View style={estilos.cabecalho}>
              <Letreiro texto={alvo.letreiro} grande />
              <View style={{ flex: 1 }}>
                <Text style={estilos.destino} numberOfLines={1}>
                  {alvo.destino}
                </Text>
                <Text style={estilos.ponto} numberOfLines={1}>
                  no ponto {alvo.nomeParada}
                </Text>
              </View>
            </View>

            <Text style={estilos.secao}>Quando avisar</Text>

            <Opcao
              selecionada={selecionada.modo === 'sair'}
              desabilitada={aPe === null}
              icone="walk"
              titulo="Na hora de sair até o ponto"
              descricao={
                aPe !== null && distancia !== null
                  ? `Você está a ${formatarDistancia(distancia)} (~${aPe} min a pé). Avisamos com ${MARGEM_SAIR_MIN} min de folga e recalculamos se você se mover.`
                  : 'Precisa do GPS ligado para calcular a caminhada.'
              }
              onPress={() => setEscolha({ modo: 'sair' })}
            />

            <Opcao
              selecionada={selecionada.modo === 'chegada'}
              icone="time-outline"
              titulo="Quando o ônibus estiver perto"
              descricao="Bom para quem já está no ponto."
              onPress={() => selecionada.modo !== 'chegada' && setEscolha({ modo: 'chegada', minutos: 5 })}>
              <View style={estilos.chips}>
                {ANTECEDENCIAS.map((min) => (
                  <Pressable
                    key={min}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ehChegada(min) }}
                    accessibilityLabel={`Avisar quando faltar ${min} minutos`}
                    onPress={() => setEscolha({ modo: 'chegada', minutos: min })}
                    style={[estilos.chip, ehChegada(min) && estilos.chipAtivo]}>
                    <Text style={[estilos.chipTexto, ehChegada(min) && estilos.chipTextoAtivo]}>faltando {min} min</Text>
                  </Pressable>
                ))}
              </View>
            </Opcao>

            <Botao titulo="Criar alerta" icone="notifications" onPress={confirmar} carregando={salvando} />
            <Text style={estilos.rodape}>
              Mantenha o app aberto para o aviso mais preciso. Se você minimizar, o celular ainda notifica no horário
              estimado.
            </Text>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

type OpcaoProps = {
  selecionada: boolean;
  desabilitada?: boolean;
  icone: NomeIcone;
  titulo: string;
  descricao: string;
  onPress: () => void;
  children?: ReactNode;
};

function Opcao({ selecionada, desabilitada, icone, titulo, descricao, onPress, children }: OpcaoProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionada, disabled: desabilitada }}
      disabled={desabilitada}
      onPress={onPress}
      style={[estilos.opcao, selecionada && estilos.opcaoAtiva, desabilitada && { opacity: 0.5 }]}>
      <View style={estilos.opcaoTopo}>
        <Ionicons name={icone} size={22} color={selecionada ? Cores.primaria : Cores.textoSecundario} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.opcaoTitulo}>{titulo}</Text>
          <Text style={estilos.opcaoDescricao}>{descricao}</Text>
        </View>
        <Ionicons
          name={selecionada ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selecionada ? Cores.primaria : Cores.textoSecundario}
        />
      </View>
      {selecionada && children}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  folha: {
    backgroundColor: Cores.superficie,
    borderTopLeftRadius: Raio.lg + 6,
    borderTopRightRadius: Raio.lg + 6,
    paddingHorizontal: Espaco.lg,
    paddingTop: Espaco.sm,
    gap: Espaco.md,
  },
  alca: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Cores.borda,
    marginBottom: Espaco.sm,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
  },
  destino: {
    fontSize: Fonte.media,
    fontWeight: '600',
    color: Cores.texto,
  },
  ponto: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
  secao: {
    fontSize: Fonte.pequena,
    fontWeight: '600',
    color: Cores.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Espaco.sm,
  },
  opcao: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    padding: Espaco.md,
    gap: Espaco.md,
  },
  opcaoAtiva: {
    borderColor: Cores.primaria,
    backgroundColor: Cores.primariaClara,
  },
  opcaoTopo: {
    flexDirection: 'row',
    gap: Espaco.md,
    alignItems: 'flex-start',
  },
  opcaoTitulo: {
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
  },
  opcaoDescricao: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    gap: Espaco.sm,
    paddingLeft: 22 + Espaco.md,
  },
  chip: {
    minHeight: ALVO_TOQUE - 4,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.pill,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.superficie,
    justifyContent: 'center',
  },
  chipAtivo: {
    backgroundColor: Cores.primaria,
    borderColor: Cores.primaria,
  },
  chipTexto: {
    fontSize: Fonte.pequena + 1,
    fontWeight: '600',
    color: Cores.texto,
  },
  chipTextoAtivo: {
    color: Cores.primariaTexto,
  },
  rodape: {
    fontSize: Fonte.pequena,
    color: Cores.textoSecundario,
    textAlign: 'center',
    lineHeight: 18,
  },
});
