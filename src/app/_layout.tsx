import * as Notifications from 'expo-notifications';
import { DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Cores } from '@/constants/tema';
import { AlertasProvider } from '@/context/AlertasContext';
import { LocalizacaoProvider } from '@/context/LocalizacaoContext';
import { prepararNotificacoes } from '@/services/notificacoes';

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Cores.primaria, background: Cores.fundo, card: Cores.superficie },
};

function useAbrirPontoAoTocarNotificacao() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const codigo = resposta.notification.request.content.data?.codigoParada;
      if (typeof codigo === 'number') {
        router.push({ pathname: '/parada/[codigo]', params: { codigo: String(codigo) } });
      }
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useAbrirPontoAoTocarNotificacao();

  useEffect(() => {
    prepararNotificacoes();
  }, []);

  return (
    <ThemeProvider value={tema}>
      <LocalizacaoProvider>
        <AlertasProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: Cores.primaria,
              headerTitleStyle: { color: Cores.texto },
              headerBackTitle: 'Voltar',
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="parada/[codigo]" options={{ title: 'Ponto' }} />
            <Stack.Screen name="linha/[codigo]" options={{ title: 'Linha' }} />
          </Stack>
        </AlertasProvider>
      </LocalizacaoProvider>
    </ThemeProvider>
  );
}
