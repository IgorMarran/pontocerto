import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mensagemDeErro } from '@/services/olhovivo';

type Estado<T> = {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
  atualizando: boolean;
};

export function useConsulta<T>(consulta: () => Promise<T>, intervaloMs?: number) {
  const [estado, setEstado] = useState<Estado<T>>({
    dados: null,
    erro: null,
    carregando: true,
    atualizando: false,
  });
  const consultaRef = useRef(consulta);
  useEffect(() => {
    consultaRef.current = consulta;
  });

  const executar = useCallback(async (manual = false) => {
    if (manual) setEstado((e) => ({ ...e, atualizando: true }));
    try {
      const dados = await consultaRef.current();
      setEstado({ dados, erro: null, carregando: false, atualizando: false });
    } catch (erro) {
      setEstado((e) => ({ ...e, erro: mensagemDeErro(erro), carregando: false, atualizando: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      executar();
      if (!intervaloMs) return;
      const timer = setInterval(() => executar(), intervaloMs);
      return () => clearInterval(timer);
    }, [executar, intervaloMs])
  );

  return { ...estado, recarregar: () => executar(true) };
}
