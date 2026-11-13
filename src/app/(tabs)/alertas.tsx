import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, Cartao, CreditoSPTrans, EstadoMensagem, Letreiro } from '@/components/ui';
import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { MARGEM_SAIR_MIN, antecedenciaEfetiva, useAlertas, type Alerta } from '@/context/AlertasContext';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import { notificarAgora } from '@/services/notificacoes';
import { formatarDistancia, type Coordenada } from '@/utils/geo';
import { formatarMinutos } from '@/utils/tempo';

export default function Alertas() {
  const { alertas, removerAlerta, limparConcluidos, permissaoNotificacao, garantirPermissaoNotificacao } = useAlertas();
  const { estado: estadoGps, pedirPermissao, abrirConfiguracoes } = useLocalizacao();

  const ativos = alertas.filter((a) => a.status === 'ativo');
  const concluidos = alertas.filter((a) => a.status !== 'ativo');

  const testarNotificacao = async () => {
    const permissao = await garantirPermissaoNotificacao();
    notificarAgora({
      titulo: 'Teste do PontoCerto',
      corpo:
        permissao === 'concedida'
          ? 'As notificações estão funcionando.'
          : 'Sem permissão de notificação: só a vibração funciona.',
    });
  };

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      {alertas.length === 0 ? (
        <EstadoMensagem
          icone="notifications-outline"
          titulo="Nenhum alerta ainda"
          texto="Abra um ponto e toque no sino de uma linha para ser avisado quando o ônibus estiver chegando ou quando for hora de sair. Numa linha, o sino de um ponto avisa a hora de descer."
          acao={{ titulo: 'Ver pontos perto de mim', icone: 'location', onPress: () => router.navigate('/') }}
        />
      ) : null}

      {ativos.length > 0 ? <Text style={estilos.secao}>Ativos</Text> : null}
      {ativos.map((a) => (
        <ItemAlerta key={a.id} alerta={a} onRemover={() => removerAlerta(a.id)} />
      ))}

      {concluidos.length > 0 ? (
        <View style={estilos.secaoLinha}>
          <Text style={estilos.secao}>Concluídos</Text>
          <Pressable onPress={limparConcluidos} accessibilityRole="button" hitSlop={8}>
            <Text style={estilos.link}>Limpar</Text>
          </Pressable>
        </View>
      ) : null}
      {concluidos.map((a) => (
        <ItemAlerta key={a.id} alerta={a} onRemover={() => removerAlerta(a.id)} />
      ))}

      <Text style={[estilos.secao, { marginTop: Espaco.xl }]}>Permissões</Text>
      <Cartao estilo={{ gap: Espaco.md }}>
        <LinhaPermissao
          icone="location"
          titulo="Localização (GPS)"
          ok={estadoGps === 'ativo'}
          texto={
            estadoGps === 'ativo'
              ? 'Liberada'
              : estadoGps === 'desligado'
                ? 'GPS do celular desligado'
                : estadoGps === 'negada'
                  ? 'Bloqueada'
                  : 'Ainda não liberada'
          }
          acao={estadoGps === 'pendente' ? pedirPermissao : estadoGps === 'ativo' ? undefined : abrirConfiguracoes}
        />
        <LinhaPermissao
          icone="notifications"
          titulo="Notificações"
          ok={permissaoNotificacao === 'concedida'}
          texto={permissaoNotificacao === 'concedida' ? 'Liberadas' : permissaoNotificacao === 'negada' ? 'Bloqueadas' : 'Ainda não liberadas'}
          acao={
            permissaoNotificacao === 'pendente'
              ? garantirPermissaoNotificacao
              : permissaoNotificacao === 'negada'
                ? () => Linking.openSettings()
                : undefined
          }
        />
        <Botao titulo="Enviar notificação de teste" icone="paper-plane-outline" variante="secundaria" onPress={testarNotificacao} />
      </Cartao>

      <CreditoSPTrans />
    </ScrollView>
  );
}

function descricaoDoAlerta(alerta: Alerta, posicao: Coordenada | null) {
  if (alerta.status === 'disparado') return alerta.mensagem ?? 'Aviso enviado.';
  if (alerta.status === 'expirado') return 'Expirou sem aviso (mais de 2 horas).';

  if (alerta.tipo === 'descida') {
    return alerta.distanciaAtual !== null
      ? `Faltam ${formatarDistancia(alerta.distanciaAtual)} até o ponto. Deixe o app aberto.`
      : 'Aguardando o GPS...';
  }

  if (alerta.erro) return alerta.erro;
  const quando =
    alerta.modo === 'sair'
      ? `Aviso quando faltar ~${antecedenciaEfetiva(alerta, posicao)} min (caminhada + ${MARGEM_SAIR_MIN} min de folga)`
      : `Aviso faltando ${alerta.antecedenciaMin} min`;
  if (alerta.ultimaConsulta === undefined) return `${quando}. Consultando a SPTrans...`;
  if (alerta.etaMin === null) return `${quando}. Nenhum ônibus previsto por enquanto.`;
  return `Ônibus a ${formatarMinutos(alerta.etaMin)}. ${quando}.`;
}

function ItemAlerta({ alerta, onRemover }: { alerta: Alerta; onRemover: () => void }) {
  const { posicao } = useLocalizacao();
  const ativo = alerta.status === 'ativo';
  const icone = alerta.tipo === 'descida' ? 'flag' : alerta.modo === 'sair' ? 'walk' : 'time';
  const tipo =
    alerta.tipo === 'descida' ? 'Descer no ponto' : alerta.modo === 'sair' ? 'Hora de sair' : 'Ônibus chegando';

  return (
    <View style={[estilos.item, !ativo && { opacity: 0.7 }]}>
      <Pressable
        style={{ flex: 1, gap: Espaco.xs }}
        accessibilityRole="button"
        accessibilityLabel={`${tipo}, ${alerta.nomeParada}. Abrir ponto`}
        onPress={() => router.push({ pathname: '/parada/[codigo]', params: { codigo: String(alerta.codigoParada) } })}>
        <View style={estilos.itemTopo}>
          <Ionicons name={icone} size={18} color={ativo ? Cores.primaria : Cores.textoSecundario} />
          <Text style={estilos.tipo}>{tipo}</Text>
          {alerta.letreiro ? <Letreiro texto={alerta.letreiro} /> : null}
        </View>
        <Text style={estilos.ponto} numberOfLines={1}>
          {alerta.nomeParada}
        </Text>
        <Text style={[estilos.descricao, alerta.tipo === 'onibus' && alerta.erro && ativo ? { color: Cores.perigo } : null]}>
          {descricaoDoAlerta(alerta, posicao)}
        </Text>
      </Pressable>
      <Pressable
        onPress={onRemover}
        style={estilos.remover}
        accessibilityRole="button"
        accessibilityLabel={ativo ? 'Cancelar alerta' : 'Remover da lista'}>
        <Ionicons name={ativo ? 'close' : 'trash-outline'} size={22} color={Cores.textoSecundario} />
      </Pressable>
    </View>
  );
}

type LinhaPermissaoProps = {
  icone: 'location' | 'notifications';
  titulo: string;
  texto: string;
  ok: boolean;
  acao?: () => void;
};

function LinhaPermissao({ icone, titulo, texto, ok, acao }: LinhaPermissaoProps) {
  return (
    <View style={estilos.permissao}>
      <Ionicons name={icone} size={20} color={ok ? Cores.primaria : Cores.alerta} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.tipo}>{titulo}</Text>
        <Text style={[estilos.descricao, { color: ok ? Cores.textoSecundario : Cores.alerta }]}>{texto}</Text>
      </View>
      {acao ? <Botao titulo="Liberar" compacto variante="secundaria" onPress={acao} /> : <Ionicons name="checkmark-circle" size={22} color={Cores.primaria} />}
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
    gap: Espaco.sm,
  },
  secao: {
    fontSize: Fonte.pequena,
    fontWeight: '600',
    color: Cores.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Espaco.sm,
  },
  secaoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Espaco.lg,
  },
  link: {
    fontSize: Fonte.pequena + 1,
    fontWeight: '600',
    color: Cores.primaria,
  },
  item: {
    flexDirection: 'row',
    gap: Espaco.sm,
    backgroundColor: Cores.superficie,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: Espaco.lg,
  },
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
  },
  tipo: {
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
  },
  ponto: {
    fontSize: Fonte.pequena + 1,
    color: Cores.texto,
  },
  descricao: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
    lineHeight: 20,
  },
  remover: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -Espaco.sm,
    marginRight: -Espaco.sm,
  },
  permissao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
  },
});
