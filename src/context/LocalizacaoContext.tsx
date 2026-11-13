import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

import type { Coordenada } from '@/utils/geo';

export type EstadoGps =
  | 'verificando'
  | 'pendente'
  | 'negada'
  | 'desligado'
  | 'ativo';

type ValorContexto = {
  estado: EstadoGps;
  posicao: Coordenada | null;
  precisao: number | null;
  pedirPermissao: () => Promise<void>;
  abrirConfiguracoes: () => void;
};

const LocalizacaoContext = createContext<ValorContexto | null>(null);

export function LocalizacaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoGps>('verificando');
  const [posicao, setPosicao] = useState<Coordenada | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const assinatura = useRef<Location.LocationSubscription | null>(null);

  const pararWatch = useCallback(() => {
    assinatura.current?.remove();
    assinatura.current = null;
  }, []);

  const iniciando = useRef(false);

  const iniciarWatch = useCallback(async () => {
    if (assinatura.current || iniciando.current) return;
    iniciando.current = true;
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setEstado('desligado');
        return;
      }
      setEstado('ativo');

      const ultima = await Location.getLastKnownPositionAsync();
      if (ultima) {
        setPosicao({ latitude: ultima.coords.latitude, longitude: ultima.coords.longitude });
        setPrecisao(ultima.coords.accuracy);
      }

      assinatura.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
        (local) => {
          setPosicao({ latitude: local.coords.latitude, longitude: local.coords.longitude });
          setPrecisao(local.coords.accuracy);
        },
        () => setEstado('desligado')
      );
    } catch {
      setEstado('desligado');
    } finally {
      iniciando.current = false;
    }
  }, []);

  const verificar = useCallback(async () => {
    const permissao = await Location.getForegroundPermissionsAsync();
    if (permissao.granted) {
      await iniciarWatch();
    } else {
      pararWatch();
      setEstado(permissao.canAskAgain ? 'pendente' : 'negada');
    }
  }, [iniciarWatch, pararWatch]);

  const pedirPermissao = useCallback(async () => {
    const resposta = await Location.requestForegroundPermissionsAsync();
    if (resposta.granted) await iniciarWatch();
    else setEstado(resposta.canAskAgain ? 'pendente' : 'negada');
  }, [iniciarWatch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    verificar();
    const sub = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') verificar();
      else if (estadoApp === 'background') pararWatch();
    });
    return () => {
      sub.remove();
      pararWatch();
    };
  }, [verificar, pararWatch]);

  const valor: ValorContexto = {
    estado,
    posicao,
    precisao,
    pedirPermissao,
    abrirConfiguracoes: () => Linking.openSettings(),
  };

  return <LocalizacaoContext.Provider value={valor}>{children}</LocalizacaoContext.Provider>;
}

export function useLocalizacao() {
  const contexto = useContext(LocalizacaoContext);
  if (!contexto) throw new Error('useLocalizacao precisa estar dentro de <LocalizacaoProvider>');
  return contexto;
}
