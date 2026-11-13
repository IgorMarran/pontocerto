import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

type VarianteBotao = 'primaria' | 'secundaria' | 'perigo' | 'texto';

type BotaoProps = {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  icone?: NomeIcone;
  carregando?: boolean;
  desabilitado?: boolean;
  compacto?: boolean;
  estilo?: StyleProp<ViewStyle>;
};

const coresBotao: Record<VarianteBotao, { fundo: string; texto: string; borda: string }> = {
  primaria: { fundo: Cores.primaria, texto: Cores.primariaTexto, borda: Cores.primaria },
  secundaria: { fundo: Cores.superficie, texto: Cores.primaria, borda: Cores.borda },
  perigo: { fundo: Cores.superficie, texto: Cores.perigo, borda: Cores.borda },
  texto: { fundo: 'transparent', texto: Cores.primaria, borda: 'transparent' },
};

export function Botao({ titulo, onPress, variante = 'primaria', icone, carregando, desabilitado, compacto, estilo }: BotaoProps) {
  const cor = coresBotao[variante];
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        compacto && estilos.botaoCompacto,
        { backgroundColor: cor.fundo, borderColor: cor.borda },
        pressed && { opacity: 0.8 },
        inativo && { opacity: 0.5 },
        estilo,
      ]}>
      {carregando ? (
        <ActivityIndicator color={cor.texto} />
      ) : (
        icone && <Ionicons name={icone} size={compacto ? 18 : 20} color={cor.texto} />
      )}
      <Text style={[estilos.textoBotao, compacto && { fontSize: Fonte.pequena + 1 }, { color: cor.texto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Cartao({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

type EstadoMensagemProps = {
  icone: NomeIcone;
  titulo: string;
  texto?: string;
  tom?: 'neutro' | 'erro' | 'alerta';
  acao?: { titulo: string; onPress: () => void; icone?: NomeIcone };
};

export function EstadoMensagem({ icone, titulo, texto, tom = 'neutro', acao }: EstadoMensagemProps) {
  const corIcone = tom === 'erro' ? Cores.perigo : tom === 'alerta' ? Cores.alerta : Cores.textoSecundario;
  return (
    <View style={estilos.estado} accessibilityLiveRegion="polite">
      <Ionicons name={icone} size={36} color={corIcone} />
      <Text style={estilos.estadoTitulo}>{titulo}</Text>
      {texto ? <Text style={estilos.estadoTexto}>{texto}</Text> : null}
      {acao ? <Botao titulo={acao.titulo} icone={acao.icone} onPress={acao.onPress} variante="secundaria" /> : null}
    </View>
  );
}

export function Faixa({ texto, tom = 'alerta', icone }: { texto: string; tom?: 'alerta' | 'erro'; icone?: NomeIcone }) {
  const erro = tom === 'erro';
  return (
    <View
      style={[estilos.faixa, { backgroundColor: erro ? Cores.perigoClara : Cores.alertaClara }]}
      accessibilityLiveRegion="polite">
      <Ionicons name={icone ?? (erro ? 'alert-circle' : 'information-circle')} size={20} color={erro ? Cores.perigo : Cores.alerta} />
      <Text style={[estilos.faixaTexto, { color: erro ? Cores.perigo : Cores.alerta }]}>{texto}</Text>
    </View>
  );
}

export function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <View accessibilityLabel="Carregando" accessibilityRole="progressbar" style={{ gap: Espaco.md }}>
      {Array.from({ length: linhas }, (_, i) => (
        <View key={i} style={estilos.esqueletoItem}>
          <View style={[estilos.esqueletoBarra, { width: '60%' }]} />
          <View style={[estilos.esqueletoBarra, { width: '35%', height: 12 }]} />
        </View>
      ))}
    </View>
  );
}

export function Letreiro({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <View style={[estilos.letreiro, grande && { paddingHorizontal: Espaco.md, paddingVertical: Espaco.sm }]}>
      <Text style={[estilos.letreiroTexto, grande && { fontSize: Fonte.media }]}>{texto}</Text>
    </View>
  );
}

export function CreditoSPTrans({ hora }: { hora?: string }) {
  return (
    <Text style={estilos.credito}>
      {hora ? `Atualizado às ${hora} · ` : ''}Dados: SPTrans – API Olho Vivo
    </Text>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: ALVO_TOQUE + 4,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.sm,
  },
  botaoCompacto: {
    minHeight: ALVO_TOQUE,
    paddingHorizontal: Espaco.md,
  },
  textoBotao: {
    fontSize: Fonte.normal,
    fontWeight: '600',
  },
  cartao: {
    backgroundColor: Cores.superficie,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: Espaco.lg,
  },
  estado: {
    alignItems: 'center',
    gap: Espaco.sm,
    paddingVertical: Espaco.xxl,
    paddingHorizontal: Espaco.xl,
  },
  estadoTitulo: {
    fontSize: Fonte.media,
    fontWeight: '600',
    color: Cores.texto,
    textAlign: 'center',
  },
  estadoTexto: {
    fontSize: Fonte.normal,
    color: Cores.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Espaco.sm,
  },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    padding: Espaco.md,
    borderRadius: Raio.md,
  },
  faixaTexto: {
    flex: 1,
    fontSize: Fonte.pequena + 1,
    lineHeight: 20,
  },
  esqueletoItem: {
    backgroundColor: Cores.superficie,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: Espaco.lg,
    gap: Espaco.sm,
  },
  esqueletoBarra: {
    height: 16,
    borderRadius: Raio.sm,
    backgroundColor: Cores.fundo,
  },
  letreiro: {
    backgroundColor: Cores.primaria,
    borderRadius: Raio.sm,
    paddingHorizontal: Espaco.sm,
    paddingVertical: Espaco.xs,
    alignSelf: 'flex-start',
  },
  letreiroTexto: {
    color: Cores.primariaTexto,
    fontWeight: '700',
    fontSize: Fonte.normal,
    fontVariant: ['tabular-nums'],
  },
  credito: {
    fontSize: Fonte.pequena,
    color: Cores.textoSecundario,
    textAlign: 'center',
    paddingVertical: Espaco.lg,
  },
});
