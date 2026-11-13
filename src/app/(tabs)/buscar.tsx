import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CreditoSPTrans, Esqueleto, EstadoMensagem, Letreiro } from '@/components/ui';
import { ALVO_TOQUE, Cores, Espaco, Fonte, Raio } from '@/constants/tema';
import { useLocalizacao } from '@/context/LocalizacaoContext';
import {
  destinoDaLinha,
  letreiroDaLinha,
  mensagemDeErro,
  olhoVivo,
  type Linha,
  type Parada,
} from '@/services/olhovivo';
import { coordDaApi, distanciaEmMetros, formatarDistancia } from '@/utils/geo';

type Modo = 'linhas' | 'pontos';

type Resultado = { modo: 'linhas'; itens: Linha[] } | { modo: 'pontos'; itens: Parada[] };

export default function Buscar() {
  const { posicao } = useLocalizacao();
  const [modo, setModo] = useState<Modo>('linhas');
  const [termo, setTermo] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pesquisar = async (modoBusca: Modo = modo) => {
    const texto = termo.trim();
    if (texto.length < 2) return;
    Keyboard.dismiss();
    setCarregando(true);
    setErro(null);
    try {
      if (modoBusca === 'linhas') {
        setResultado({ modo: 'linhas', itens: await olhoVivo.buscarLinhas(texto) });
      } else {
        const paradas = await olhoVivo.buscarParadas(texto);
        if (posicao) {
          paradas.sort(
            (a, b) => distanciaEmMetros(posicao, coordDaApi(a)) - distanciaEmMetros(posicao, coordDaApi(b))
          );
        }
        setResultado({ modo: 'pontos', itens: paradas });
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const trocarModo = (novo: Modo) => {
    setModo(novo);
    setResultado(null);
    if (termo.trim().length >= 2) pesquisar(novo);
  };

  const conteudoVazio = carregando ? (
    <Esqueleto linhas={4} />
  ) : erro ? (
    <EstadoMensagem icone="cloud-offline-outline" tom="erro" titulo="Não deu para buscar" texto={erro} acao={{ titulo: 'Tentar de novo', onPress: () => pesquisar() }} />
  ) : resultado ? (
    <EstadoMensagem
      icone="search"
      titulo="Nada encontrado"
      texto={modo === 'linhas' ? 'Tente o número (ex.: 8000) ou o destino (ex.: Lapa).' : 'Tente só o nome da rua, sem "Rua" ou "Av." (ex.: Paulista).'}
    />
  ) : (
    <EstadoMensagem
      icone={modo === 'linhas' ? 'bus-outline' : 'pin-outline'}
      titulo={modo === 'linhas' ? 'Encontre uma linha' : 'Encontre um ponto'}
      texto={modo === 'linhas' ? 'Digite o número ou o destino da linha para ver os ônibus no mapa.' : 'Digite o nome do ponto ou da rua para ver os próximos ônibus.'}
    />
  );

  return (
    <View style={estilos.tela}>
      <View style={estilos.topo}>
        <View style={estilos.segmentos} accessibilityRole="tablist">
          {(['linhas', 'pontos'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: modo === m }}
              onPress={() => trocarModo(m)}
              style={[estilos.segmento, modo === m && estilos.segmentoAtivo]}>
              <Text style={[estilos.segmentoTexto, modo === m && estilos.segmentoTextoAtivo]}>
                {m === 'linhas' ? 'Linhas' : 'Pontos'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={estilos.campo}>
          <Ionicons name="search" size={20} color={Cores.textoSecundario} />
          <TextInput
            value={termo}
            onChangeText={setTermo}
            onSubmitEditing={() => pesquisar()}
            placeholder={modo === 'linhas' ? 'Número ou destino, ex.: 8000, Lapa' : 'Nome do ponto ou rua, ex.: Paulista'}
            placeholderTextColor={Cores.textoSecundario}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={modo === 'linhas' ? 'Buscar linha' : 'Buscar ponto'}
            style={estilos.input}
          />
          {termo ? (
            <Pressable onPress={() => setTermo('')} accessibilityLabel="Limpar busca" hitSlop={12}>
              <Ionicons name="close-circle" size={20} color={Cores.textoSecundario} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList<Linha | Parada>
        data={resultado?.itens ?? []}
        keyExtractor={(item) => String('cl' in item ? item.cl : item.cp)}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={conteudoVazio}
        ListFooterComponent={resultado?.itens.length ? <CreditoSPTrans /> : undefined}
        ItemSeparatorComponent={() => <View style={{ height: Espaco.sm }} />}
        renderItem={({ item }) =>
          'cl' in item ? <ItemLinha linha={item} /> : <ItemPonto parada={item} distancia={posicao ? distanciaEmMetros(posicao, coordDaApi(item)) : null} />
        }
      />
    </View>
  );
}

function ItemLinha({ linha }: { linha: Linha }) {
  const letreiro = letreiroDaLinha(linha);
  const destino = destinoDaLinha(linha);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Linha ${letreiro}, sentido ${destino}`}
      onPress={() =>
        router.push({ pathname: '/linha/[codigo]', params: { codigo: String(linha.cl), letreiro, destino } })
      }
      style={({ pressed }) => [estilos.item, pressed && { backgroundColor: Cores.fundo }]}>
      <Letreiro texto={letreiro} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo} numberOfLines={1}>
          {destino}
        </Text>
        <Text style={estilos.subtitulo} numberOfLines={1}>
          {linha.lc ? 'Circular · ' : ''}saindo de {linha.sl === 1 ? linha.tp : linha.ts}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Cores.textoSecundario} />
    </Pressable>
  );
}

function ItemPonto({ parada, distancia }: { parada: Parada; distancia: number | null }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ponto ${parada.np}${distancia !== null ? `, a ${formatarDistancia(distancia)}` : ''}`}
      onPress={() =>
        router.push({
          pathname: '/parada/[codigo]',
          params: { codigo: String(parada.cp), nome: parada.np, py: String(parada.py), px: String(parada.px) },
        })
      }
      style={({ pressed }) => [estilos.item, pressed && { backgroundColor: Cores.fundo }]}>
      <Ionicons name="pin" size={22} color={Cores.primaria} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo} numberOfLines={1}>
          {parada.np || 'Ponto sem nome'}
        </Text>
        {parada.ed ? (
          <Text style={estilos.subtitulo} numberOfLines={1}>
            {parada.ed}
          </Text>
        ) : null}
      </View>
      {distancia !== null ? <Text style={estilos.distancia}>{formatarDistancia(distancia)}</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  topo: {
    padding: Espaco.lg,
    gap: Espaco.md,
    backgroundColor: Cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },
  segmentos: {
    flexDirection: 'row',
    backgroundColor: Cores.fundo,
    borderRadius: Raio.md,
    padding: Espaco.xs,
  },
  segmento: {
    flex: 1,
    minHeight: ALVO_TOQUE - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Raio.sm,
  },
  segmentoAtivo: {
    backgroundColor: Cores.superficie,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  segmentoTexto: {
    fontSize: Fonte.normal,
    color: Cores.textoSecundario,
    fontWeight: '500',
  },
  segmentoTextoAtivo: {
    color: Cores.texto,
    fontWeight: '700',
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    minHeight: ALVO_TOQUE + 4,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.superficie,
  },
  input: {
    flex: 1,
    fontSize: Fonte.normal,
    color: Cores.texto,
    paddingVertical: Espaco.sm,
  },
  lista: {
    padding: Espaco.lg,
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    minHeight: 64,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.md,
    backgroundColor: Cores.superficie,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  titulo: {
    fontSize: Fonte.normal,
    fontWeight: '600',
    color: Cores.texto,
  },
  subtitulo: {
    fontSize: Fonte.pequena + 1,
    color: Cores.textoSecundario,
  },
  distancia: {
    fontSize: Fonte.pequena + 1,
    fontWeight: '700',
    color: Cores.primaria,
  },
});
