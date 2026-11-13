# PontoCerto

App em React Native (Expo) que usa a **API Olho Vivo da SPTrans**, o **GPS** e **notificações** para ajudar quem anda de ônibus em São Paulo.

Global Solution 2026.2 · Cross-Platform Application Development

**Vídeo:** _cole aqui o link do YouTube_

## O que o app faz

- **Perto de mim:** mostra os pontos de ônibus mais próximos, com distância, tempo a pé e os próximos ônibus de cada um.
- **Buscar:** encontra linhas (número ou destino) e pontos (nome ou rua).
- **Ponto:** previsão de chegada das linhas, atualizada a cada 30 segundos, com mapa dos ônibus a caminho.
- **Linha:** mapa com o trajeto e os ônibus em tempo real.
- **Alertas:**
  - **Ônibus chegando:** avisa quando faltarem 3, 5 ou 10 minutos.
  - **Hora de sair:** calcula pelo GPS o tempo de caminhada até o ponto e avisa a hora certa de sair.
  - **Desça no ponto certo:** durante a viagem, vibra e avisa quando você estiver chegando ao ponto de descida.

Os avisos usam notificação local, vibração e alerta na tela.

## Como executar

1. Gere um token na [área de desenvolvedores da SPTrans](https://www.sptrans.com.br/desenvolvedores/) (em **Meus Aplicativos**).
2. Crie o arquivo `.env` na raiz do projeto:

   ```bash
   cp .env.example .env
   ```

   e coloque o token:

   ```
   EXPO_PUBLIC_OLHOVIVO_TOKEN=seu_token
   ```

3. Instale e rode (Node.js 20 ou superior):

   ```bash
   npm install
   npx expo start
   ```

4. Leia o QR Code com o app **Expo Go** no celular. Celular e computador precisam estar na mesma rede Wi-Fi; se não der, use `npx expo start --tunnel`.

## Tecnologias

Expo SDK 58, React Native, TypeScript, Expo Router, `expo-location`, `expo-notifications` e `react-native-maps`.

## Estrutura

```
src/
├── app/          telas (Perto de mim, Buscar, Alertas, Ponto, Linha)
├── components/   componentes visuais
├── context/      GPS e alertas
├── hooks/        consulta com atualização automática
├── services/     API Olho Vivo, pontos próximos e notificações
└── utils/        distância e horários
```

## Integrantes

| Nome | RM |
| --- | --- |
| Igor Mota Marran | 567823 |
| Murylo Silva Amaral | 568241 |
| Dante Daher Garçon | 567727 |

Divisão do trabalho: [`INTEGRANTES.txt`](INTEGRANTES.txt).

## Créditos

Dados: **SPTrans – API Olho Vivo**.
