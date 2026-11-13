import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { Cores } from '@/constants/tema';
import { useAlertas } from '@/context/AlertasContext';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

function icone(nome: NomeIcone) {
  return function IconeDaAba({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={nome} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const { alertas } = useAlertas();
  const ativos = alertas.filter((a) => a.status === 'ativo').length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Cores.primaria,
        tabBarInactiveTintColor: Cores.textoSecundario,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerTitleStyle: { color: Cores.texto },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Perto de mim',
          tabBarIcon: icone('location'),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar',
          tabBarIcon: icone('search'),
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarBadge: ativos > 0 ? ativos : undefined,
          tabBarBadgeStyle: { backgroundColor: Cores.primaria },
          tabBarIcon: icone('notifications'),
        }}
      />
    </Tabs>
  );
}
