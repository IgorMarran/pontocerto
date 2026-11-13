import { useLocalizacao } from '@/context/LocalizacaoContext';

import { EstadoMensagem } from './ui';

export function PermissaoGps() {
  const { estado, pedirPermissao, abrirConfiguracoes } = useLocalizacao();

  if (estado === 'pendente') {
    return (
      <EstadoMensagem
        icone="location-outline"
        titulo="Use sua localização"
        texto="Com o GPS, o app encontra os pontos de ônibus perto de você e calcula quanto tempo você leva a pé até eles. A localização fica só no seu celular."
        acao={{ titulo: 'Permitir localização', icone: 'location', onPress: pedirPermissao }}
      />
    );
  }

  if (estado === 'negada') {
    return (
      <EstadoMensagem
        icone="location-outline"
        tom="alerta"
        titulo="Localização bloqueada"
        texto="Você negou o acesso ao GPS. Para ver os pontos perto de você, libere a localização nas configurações do celular. A aba Buscar continua funcionando sem GPS."
        acao={{ titulo: 'Abrir configurações', icone: 'settings-outline', onPress: abrirConfiguracoes }}
      />
    );
  }

  if (estado === 'desligado') {
    return (
      <EstadoMensagem
        icone="navigate-circle-outline"
        tom="alerta"
        titulo="GPS desligado"
        texto="Ligue a localização do celular e volte para o app."
        acao={{ titulo: 'Abrir configurações', icone: 'settings-outline', onPress: abrirConfiguracoes }}
      />
    );
  }

  return null;
}
