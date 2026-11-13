import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

const CANAL_ANDROID = 'alertas-onibus';
const PADRAO_VIBRACAO = [0, 500, 250, 500, 250, 500];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 13+: o pedido de permissão só aparece depois que existe um canal.
export async function prepararNotificacoes() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Alertas de ônibus',
      description: 'Avisos de chegada do ônibus, hora de sair e ponto de descida',
      importance: AndroidImportance.MAX,
      vibrationPattern: PADRAO_VIBRACAO,
      lightColor: '#0B6E4F',
    });
  }
}

export type EstadoPermissao = 'concedida' | 'negada' | 'pendente';

export async function estadoPermissaoNotificacoes(): Promise<EstadoPermissao> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL) {
    return 'concedida';
  }
  return status.canAskAgain ? 'pendente' : 'negada';
}

export async function pedirPermissaoNotificacoes(): Promise<EstadoPermissao> {
  await prepararNotificacoes();
  const atual = await estadoPermissaoNotificacoes();
  if (atual !== 'pendente') return atual;
  const resposta = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return resposta.granted ? 'concedida' : resposta.canAskAgain ? 'pendente' : 'negada';
}

type Conteudo = { titulo: string; corpo: string; dados?: Record<string, unknown> };

function conteudo({ titulo, corpo, dados }: Conteudo): Notifications.NotificationContentInput {
  return {
    title: titulo,
    body: corpo,
    data: dados ?? {},
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: PADRAO_VIBRACAO,
  };
}

export async function notificarAgora(mensagem: Conteudo) {
  Vibration.vibrate(PADRAO_VIBRACAO);
  try {
    await Notifications.scheduleNotificationAsync({
      content: conteudo(mensagem),
      trigger: Platform.OS === 'android' ? { channelId: CANAL_ANDROID } : null,
    });
  } catch {
    // Sem permissão: a vibração e o alerta na tela continuam funcionando.
  }
}

// Garante o aviso no horário estimado mesmo se o app for minimizado.
export async function agendarNotificacao(mensagem: Conteudo, quando: Date) {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: conteudo(mensagem),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: quando,
        channelId: CANAL_ANDROID,
      },
    });
  } catch {
    return undefined;
  }
}

export async function cancelarNotificacao(id: string | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Já disparou ou já foi cancelada.
  }
}
